import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

router.get("/", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM first_process_sessions ORDER BY created_at");
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM first_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  res.json(rows[0]);
});

router.post("/start", async (req, res) => {
  const { orderId, processType, workDate, targetQty, parentSessionId, restartFromQty, note } = req.body;
  const startedAt = now();

  const [result] = await pool.execute(
    "INSERT INTO first_process_sessions (order_id, process_type, work_date, target_qty, short_qty, started_at, status, parent_session_id, restart_from_qty, note, created_at) VALUES (?,?,?,?,0,?,'IN_PROGRESS',?,?,?,?)",
    [orderId ?? null, processType, workDate, targetQty, startedAt, parentSessionId ?? null, restartFromQty ?? null, note ?? null, startedAt]
  );
  const id = result.insertId;

  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, timestamp, note) VALUES (?,?,?,?,?,?)",
    [parentSessionId ? "PROCESS_DEFECT_RESTART" : "WORK_START", "FIRST", id, orderId ?? null, startedAt,
     parentSessionId ? `공정불량 재시작 (원본 #${parentSessionId}, ${restartFromQty}장 중단)` : "1차 공정 작업 시작"]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, order_id, qty, timestamp, note) VALUES (?,?,?,?,?,?,?)",
    ["MATERIAL_TO_FIRST", "FIRST", id, orderId ?? null, targetQty, startedAt, `${processType} 원자재 투입`]
  );

  res.status(201).json({ id, startedAt });
});

router.patch("/:id/defect-stop", async (req, res) => {
  const { stoppedAtQty, note } = req.body;
  const endedAt = now();
  await pool.execute(
    "UPDATE first_process_sessions SET status='DEFECT_STOPPED', restart_from_qty=?, ended_at=?, output_qty=? WHERE id=?",
    [stoppedAtQty, endedAt, stoppedAtQty, req.params.id]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, qty, timestamp, note) VALUES (?,?,?,?,?,?)",
    ["PROCESS_DEFECT", "FIRST", req.params.id, stoppedAtQty, endedAt, note ?? `${stoppedAtQty}장에서 공정불량 발생`]
  );
  res.json({ ok: true, endedAt });
});

router.patch("/:id/done", async (req, res) => {
  const { outputQty, shortQty, note } = req.body;
  const endedAt = now();
  await pool.execute(
    "UPDATE first_process_sessions SET status='DONE', output_qty=?, short_qty=?, ended_at=? WHERE id=?",
    [outputQty, shortQty ?? 0, endedAt, req.params.id]
  );
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, qty, timestamp, note) VALUES (?,?,?,?,?,?)",
    ["WORK_DONE", "FIRST", req.params.id, outputQty, endedAt, note ?? `1차 공정 완료 (생산 ${outputQty}, 불량 ${shortQty ?? 0})`]
  );
  res.json({ ok: true, endedAt });
});

router.post("/:id/short", async (req, res) => {
  const { qty, note } = req.body;
  const timestamp = now();
  const [rows] = await pool.execute("SELECT short_qty FROM first_process_sessions WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });

  await pool.execute("UPDATE first_process_sessions SET short_qty = ? WHERE id = ?",
    [(rows[0].short_qty ?? 0) + qty, req.params.id]);
  await pool.execute(
    "INSERT INTO event_logs (event_type, session_type, session_id, qty, timestamp, note) VALUES (?,?,?,?,?,?)",
    ["SHORT_RECORD", "FIRST", req.params.id, qty, timestamp, note ?? `불량 ${qty}개 기록`]
  );
  res.json({ ok: true });
});

export default router;
