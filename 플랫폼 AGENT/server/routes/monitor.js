import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

// EM 생산기업 현황
router.get("/em", async (req, res) => {
  const [orders]   = await pool.execute("SELECT status, COUNT(*) as cnt, SUM(quantity) as total FROM em_agent.orders GROUP BY status");
  const [stocks]   = await pool.execute("SELECT material_type, SUM(quantity) as total FROM em_agent.raw_stock_receipts GROUP BY material_type");
  const [sessions] = await pool.execute("SELECT status, COUNT(*) as cnt FROM em_agent.second_process_sessions GROUP BY status");
  const [recent]   = await pool.execute("SELECT event_type, order_id, qty, material_type, timestamp, note FROM em_agent.event_logs ORDER BY timestamp DESC LIMIT 10");
  res.json({ orders, stocks, sessions, recentEvents: recent });
});

// 물류기업 현황
router.get("/logistics", async (req, res) => {
  const [vehicles]  = await pool.execute("SELECT status, COUNT(*) as cnt FROM logistics_agent.vehicles GROUP BY status");
  const [requests]  = await pool.execute("SELECT status, request_type, COUNT(*) as cnt FROM logistics_agent.dispatch_requests GROUP BY status, request_type");
  const [dispatches]= await pool.execute("SELECT status, COUNT(*) as cnt FROM logistics_agent.dispatches GROUP BY status");
  const [recent]    = await pool.execute("SELECT event_type, timestamp, note FROM logistics_agent.event_logs ORDER BY timestamp DESC LIMIT 10");
  res.json({ vehicles, requests, dispatches, recentEvents: recent });
});

// 등록 기업 목록
router.get("/companies", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM platform_agent.companies ORDER BY joined_at");
  res.json(rows);
});

// 플랫폼 통합 로그
router.get("/logs", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM platform_agent.platform_logs ORDER BY logged_at DESC LIMIT 50");
  res.json(rows);
});

export default router;
