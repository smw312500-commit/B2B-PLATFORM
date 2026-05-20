import { Router } from "express";
import { pool } from "../db/index.js";

const WEIGHT_PER_UNIT = { FABRIC: 1.2, STICKER_PAPER: 1.3, CHIP: 1.5 / 50000 };
const CARGO_LABEL     = { FABRIC: "원단 롤 수입", STICKER_PAPER: "스티커지 수입", CHIP: "RFID 칩 수입" };

const PLATFORM_URL = process.env.PLATFORM_URL ?? "http://localhost:3000";

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

// B/L 등록 (+ raw_stock_receipts 생성 + 플랫폼 API 경유 배차 요청)
router.post("/", async (req, res) => {
  const { blNumber, vessel, originPort, destinationPort, pickupAddress, deliveryAddress, eta, items } = req.body;

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

    // 물류 DB 직접 접근 대신 플랫폼 API 경유 (도메인 분리)
    const weightKg = +(item.quantity * (WEIGHT_PER_UNIT[item.materialType] ?? 0)).toFixed(2);
    const pickup   = (pickupAddress ?? "").split(",")[0].trim() || pickupAddress;
    fetch(`${PLATFORM_URL}/api/notify/dispatch-request`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType:      "IMPORT",
        cargoDesc:        CARGO_LABEL[item.materialType] ?? item.materialType,
        qty:              item.quantity,
        weightKg,
        pickupLocation:   pickup,
        deliveryLocation: deliveryAddress ?? null,
        emReceiptId:      receiptId,
      }),
    }).catch(err => console.warn("[플랫폼 배차요청 실패]", err.message));
  }

  res.status(201).json({ id: blId });
});

export default router;
