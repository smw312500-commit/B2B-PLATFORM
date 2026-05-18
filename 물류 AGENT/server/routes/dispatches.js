import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, request_id AS requestId, vehicle_id AS vehicleId, status,
           assigned_at AS assignedAt, estimated_pickup AS estimatedPickup,
           estimated_delivery AS estimatedDelivery,
           actual_delivered_at AS actualDeliveredAt, note,
           created_at AS createdAt
    FROM dispatches ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/assign", async (req, res, next) => {
  try {
    const { requestId, vehicleId, estimatedPickup, estimatedDelivery, note } = req.body;
    const ts = now();

    const [result] = await pool.execute(
      "INSERT INTO dispatches (request_id, vehicle_id, assigned_at, estimated_pickup, estimated_delivery, status, note, created_at) VALUES (?,?,?,?,?,'ASSIGNED',?,?)",
      [requestId, vehicleId, ts, estimatedPickup ?? null, estimatedDelivery ?? null, note ?? null, ts]
    );
    const id = result.insertId;

    await pool.execute("UPDATE dispatch_requests SET status = 'ASSIGNED' WHERE id = ?", [requestId]);
    await pool.execute("UPDATE vehicles SET status = 'ON_DUTY' WHERE id = ?", [vehicleId]);
    await pool.execute(
      "INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note) VALUES (?,?,?,?,?,?)",
      ["DISPATCH_ASSIGNED", id, vehicleId, requestId, ts, note ?? null]
    );

    res.status(201).json({ id });
  } catch (err) { next(err); }
});

router.patch("/:id/status", async (req, res) => {
  const { status, note } = req.body;
  const ts = now();
  const [rows] = await pool.execute("SELECT * FROM dispatches WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "배차를 찾을 수 없습니다." });
  const dispatch = rows[0];

  if (status === "DELIVERED") {
    await pool.execute("UPDATE dispatches SET status=?, actual_delivered_at=? WHERE id=?", [status, ts, req.params.id]);
    await pool.execute("UPDATE vehicles SET status='AVAILABLE' WHERE id=?", [dispatch.vehicle_id]);
    await pool.execute("UPDATE dispatch_requests SET status='COMPLETED' WHERE id=?", [dispatch.request_id]);
  } else {
    await pool.execute("UPDATE dispatches SET status=? WHERE id=?", [status, req.params.id]);
  }

  await pool.execute(
    "INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note) VALUES (?,?,?,?,?,?)",
    ["STATUS_CHANGED", req.params.id, dispatch.vehicle_id, dispatch.request_id, ts, note ?? `상태 변경: ${status}`]
  );
  res.json({ ok: true });
});

export default router;
