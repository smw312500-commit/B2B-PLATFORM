import { Router } from "express";
import { pool } from "../db/index.js";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const WEIGHT_PER_UNIT = { FABRIC: 1.2, STICKER_PAPER: 1.3, CHIP: 1.5 / 50000 };
const CARGO_LABEL     = { FABRIC: "원단 롤 수입", STICKER_PAPER: "스티커지 수입", CHIP: "RFID 칩 수입" };

// 물류 DB 풀 (같은 MySQL 인스턴스, logistics_agent DB)
const logisticsPool = mysql.createPool({
  host:     process.env.MYSQL_HOST     ?? "localhost",
  port:     Number(process.env.MYSQL_PORT ?? 3306),
  user:     process.env.MYSQL_USER     ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: "logistics_agent",
  charset:  "utf8mb4",
});

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// B/L 목록 조회
router.get("/", async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT b.*,
           COUNT(r.id) as item_count,
           SUM(CASE WHEN r.material_type='FABRIC' THEN r.quantity ELSE 0 END) as fabric_qty,
           SUM(CASE WHEN r.material_type='STICKER_PAPER' THEN r.quantity ELSE 0 END) as sticker_qty,
           SUM(CASE WHEN r.material_type='CHIP' THEN r.quantity ELSE 0 END) as chip_qty
    FROM bl_imports b
    LEFT JOIN raw_stock_receipts r ON r.bl_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
  res.json(rows);
});

// B/L 등록 (+ 연결된 raw_stock_receipts 생성)
router.post("/", async (req, res) => {
  const { blNumber, vessel, originPort, destinationPort, pickupAddress, deliveryAddress, eta, items } = req.body;
  // items: [{ materialType, quantity }]

  const ts = now();
  const [blResult] = await pool.execute(
    `INSERT INTO bl_imports (bl_number, vessel, origin_port, destination_port, pickup_address, delivery_address, eta, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [blNumber, vessel ?? null, originPort ?? null, destinationPort ?? null,
     pickupAddress ?? null, deliveryAddress ?? null, eta, ts]
  );
  const blId = blResult.insertId;

  for (const item of (items ?? [])) {
    const [receiptResult] = await pool.execute(
      `INSERT INTO raw_stock_receipts (material_type, quantity, received_date, note, bl_id, created_at)
       VALUES (?,?,?,?,?,?)`,
      [item.materialType, item.quantity, eta, `B/L ${blNumber}`, blId, ts]
    );
    const receiptId = receiptResult.insertId;

    await pool.execute(
      `INSERT INTO event_logs (event_type, qty, material_type, timestamp, note)
       VALUES ('MATERIAL_RECEIPT',?,?,?,?)`,
      [item.quantity, item.materialType, ts, `B/L ${blNumber} 입고 등록`]
    );

    // 물류 dispatch_requests에 자동 등록 (중복 방지: em_receipt_id UNIQUE)
    const weightKg = +(item.quantity * (WEIGHT_PER_UNIT[item.materialType] ?? 0)).toFixed(2);
    const cargoDesc = CARGO_LABEL[item.materialType] ?? item.materialType;
    const pickup = (pickupAddress ?? "").split(",")[0].trim() || pickupAddress;
    await logisticsPool.execute(
      `INSERT IGNORE INTO dispatch_requests
         (request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location, status, requested_at, em_receipt_id)
       VALUES ('IMPORT',?,?,?,?,?,'PENDING',?,?)`,
      [cargoDesc, item.quantity, weightKg, pickup, deliveryAddress ?? null, ts, receiptId]
    );
  }

  res.status(201).json({ id: blId });
});

export default router;
