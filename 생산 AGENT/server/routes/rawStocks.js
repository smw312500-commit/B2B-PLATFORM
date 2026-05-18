import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM raw_stock_receipts ORDER BY received_date");
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { materialType, quantity, receivedDate, note } = req.body;
  const ts = now();
  const [result] = await pool.execute(
    "INSERT INTO raw_stock_receipts (material_type, quantity, received_date, note, created_at) VALUES (?,?,?,?,?)",
    [materialType, quantity, receivedDate, note ?? null, ts]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, qty, material_type, timestamp, note) VALUES (?,?,?,?,?)",
    ["MATERIAL_RECEIPT", quantity, materialType, ts, `${materialType} ${quantity} 입고`]
  );
  res.status(201).json({ id: result.insertId });
});

router.delete("/:id", async (req, res) => {
  await pool.execute("DELETE FROM raw_stock_receipts WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

export default router;
