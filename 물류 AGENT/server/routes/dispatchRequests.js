import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, request_type AS requestType, cargo_desc AS cargoDesc,
           qty, weight_kg AS weightKg, pickup_location AS pickupLocation,
           delivery_location AS deliveryLocation, status,
           requested_at AS requestedAt,
           em_order_id AS emOrderId, em_receipt_id AS emReceiptId,
           note
    FROM dispatch_requests ORDER BY requested_at DESC`);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { requestType, cargoDesc, qty, weightKg, pickupLocation, deliveryLocation } = req.body;
  const [result] = await pool.execute(
    "INSERT INTO dispatch_requests (request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location, requested_at, status) VALUES (?,?,?,?,?,?,?,'PENDING')",
    [requestType, cargoDesc, qty ?? null, weightKg ?? null, pickupLocation, deliveryLocation, now()]
  );
  res.status(201).json({ id: result.insertId });
});

router.patch("/:id/status", async (req, res) => {
  await pool.execute("UPDATE dispatch_requests SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ ok: true });
});

export default router;
