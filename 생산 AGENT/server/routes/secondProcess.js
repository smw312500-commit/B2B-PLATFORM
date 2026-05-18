import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM second_process_sessions ORDER BY created_at");
  res.json(rows);
});

router.get("/machine/:machineId", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM second_process_sessions WHERE machine_id = ? ORDER BY created_at",
    [req.params.machineId]
  );
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM second_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  res.json(rows[0]);
});

router.post("/start", async (req, res) => {
  const { orderId, machineId, processType, unitsPerHour, workDate, targetQty, parentSessionId, restartFromQty, note } = req.body;
  const startedAt = now();

  const [result] = await pool.execute(
    "INSERT INTO second_process_sessions (order_id, machine_id, process_type, units_per_hour, work_date, target_qty, short_qty, started_at, status, parent_session_id, restart_from_qty, note, created_at) VALUES (?,?,?,?,?,?,0,?,'IN_PROGRESS',?,?,?,?)",
    [orderId ?? null, machineId, processType, unitsPerHour, workDate, targetQty, startedAt, parentSessionId ?? null, restartFromQty ?? null, note ?? null, startedAt]
  );
  const id = result.insertId;

  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, timestamp, note) VALUES (?,?,?,?,?,?,?)",
    [parentSessionId ? "PROCESS_DEFECT_RESTART" : "WORK_START", "SECOND", id, orderId ?? null, machineId, startedAt,
     parentSessionId ? `공정불량 재시작 (원본 #${parentSessionId})` : `2차 공정 시작 (기계 #${machineId})`]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, qty, timestamp, note) VALUES (?,?,?,?,?,?,?,?)",
    ["FIRST_TO_SECOND", "SECOND", id, orderId ?? null, machineId, targetQty, startedAt, `1차 롤 → 2차 투입 (기계 #${machineId}, ${targetQty}개)`]
  );

  res.status(201).json({ id, startedAt });
});

router.patch("/:id/defect-stop", async (req, res) => {
  const { stoppedAtQty, note } = req.body;
  const endedAt = now();
  const [rows] = await pool.execute("SELECT * FROM second_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const session = rows[0];

  const workMinutes = session.started_at
    ? Math.round((new Date(endedAt) - new Date(session.started_at)) / 60000) : null;

  await pool.execute(
    "UPDATE second_process_sessions SET status='DEFECT_STOPPED', restart_from_qty=?, ended_at=?, output_qty=?, work_minutes=? WHERE id=?",
    [stoppedAtQty, endedAt, stoppedAtQty, workMinutes, req.params.id]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, qty, timestamp, note) VALUES (?,?,?,?,?,?,?,?)",
    ["PROCESS_DEFECT", "SECOND", req.params.id, session.order_id, session.machine_id, stoppedAtQty, endedAt,
     note ?? `기계 #${session.machine_id} - ${stoppedAtQty}장 공정불량`]
  );
  res.json({ ok: true, endedAt, workMinutes });
});

router.patch("/:id/done", async (req, res) => {
  const { outputQty, shortQty, note } = req.body;
  const endedAt = now();
  const [rows] = await pool.execute("SELECT * FROM second_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const session = rows[0];

  const workMinutes = session.started_at
    ? Math.round((new Date(endedAt) - new Date(session.started_at)) / 60000) : null;

  await pool.execute(
    "UPDATE second_process_sessions SET status='DONE', output_qty=?, short_qty=?, ended_at=?, work_minutes=? WHERE id=?",
    [outputQty, shortQty ?? 0, endedAt, workMinutes, req.params.id]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, qty, timestamp, note) VALUES (?,?,?,?,?,?,?,?)",
    ["WORK_DONE", "SECOND", req.params.id, session.order_id, session.machine_id, outputQty, endedAt,
     note ?? `기계 #${session.machine_id} 완료 (생산 ${outputQty}, 불량 ${shortQty ?? 0}, ${workMinutes}분)`]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, qty, timestamp) VALUES (?,?,?,?,?,?,?)",
    ["SECOND_PROCESS_DONE", "SECOND", req.params.id, session.order_id, session.machine_id, outputQty, endedAt]
  );
  res.json({ ok: true, endedAt, workMinutes });
});

router.post("/:id/short", async (req, res) => {
  const { qty, note } = req.body;
  const timestamp = now();
  const [rows] = await pool.execute("SELECT * FROM second_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const session = rows[0];

  await pool.execute("UPDATE second_process_sessions SET short_qty = ? WHERE id = ?",
    [(session.short_qty ?? 0) + qty, req.params.id]);
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, machine_id, qty, timestamp, note) VALUES (?,?,?,?,?,?,?,?)",
    ["SHORT_RECORD", "SECOND", req.params.id, session.order_id, session.machine_id, qty, timestamp,
     note ?? `기계 #${session.machine_id} 불량 ${qty}개`]
  );
  res.json({ ok: true });
});

export default router;
