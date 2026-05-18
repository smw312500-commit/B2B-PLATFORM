import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

router.get("/", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM event_logs ORDER BY timestamp DESC");
  res.json(rows);
});

router.get("/session/:type/:sessionId", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM event_logs WHERE session_id = ? ORDER BY timestamp",
    [req.params.sessionId]
  );
  res.json(rows);
});

router.get("/type/:eventType", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM event_logs WHERE event_type = ? ORDER BY timestamp DESC",
    [req.params.eventType]
  );
  res.json(rows);
});

export default router;
