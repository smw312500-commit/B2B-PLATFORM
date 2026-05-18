import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const COMPANY_NAME   = "EM AI Agent";
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS ?? "서울 금천구 공장";
const PLATFORM_URL   = process.env.PLATFORM_URL    ?? "http://localhost:3000";

const ORDER_SELECT = `
  SELECT id, order_number AS orderNumber, customer_name AS customerName,
         product_type AS productType, quantity, job_type AS jobType,
         cutting, priority, status,
         DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate,
         created_at AS createdAt, completed_at AS completedAt
  FROM orders`;

router.get("/", async (req, res) => {
  const [rows] = await pool.execute(`${ORDER_SELECT} ORDER BY created_at`);
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [rows] = await pool.execute(`${ORDER_SELECT} WHERE id = ?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "수주를 찾을 수 없습니다." });
  res.json(rows[0]);
});

router.post("/", async (req, res) => {
  const { id, orderNumber, customerName, productType, quantity, jobType, cutting, priority, status, dueDate, createdAt } = req.body;
  await pool.execute(
    "INSERT INTO orders (id, order_number, customer_name, product_type, quantity, job_type, cutting, priority, status, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [id, orderNumber ?? id, customerName, productType, quantity, jobType, cutting, priority, status, dueDate, createdAt ?? now()]
  );
  res.status(201).json({ id });
});

router.patch("/:id", async (req, res) => {
  const allowed = ["status", "priority", "jobType", "cutting", "dueDate", "quantity"];
  const colMap  = {
    status: "status", priority: "priority", jobType: "job_type",
    cutting: "cutting", dueDate: "due_date", quantity: "quantity",
    completedAt: "completed_at",
  };
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (!Object.keys(updates).length) return res.status(400).json({ error: "수정할 필드가 없습니다." });

  if (updates.status === "DONE") updates.completedAt = now();
  else if (updates.status !== undefined) updates.completedAt = null;

  const setClauses = Object.keys(updates).map(k => `${colMap[k] ?? k} = ?`).join(", ");
  const values = [...Object.values(updates), req.params.id];
  await pool.execute(`UPDATE orders SET ${setClauses} WHERE id = ?`, values);

  // READY_TO_SHIP → 플랫폼에 출고 준비 알림 (플랫폼이 물류 배차 대행)
  if (updates.status === "READY_TO_SHIP") {
    const [rows] = await pool.execute(
      "SELECT id, order_number, customer_name, product_type, quantity FROM orders WHERE id = ?",
      [req.params.id]
    );
    if (rows.length) {
      const o = rows[0];
      fetch(`${PLATFORM_URL}/api/notify/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:     COMPANY_NAME,
          orderId:         o.id,
          orderNumber:     o.order_number,
          productType:     o.product_type,
          quantity:        o.quantity,
          customerName:    o.customer_name,
          pickupAddress:   FACTORY_ADDRESS,
          deliveryAddress: null,
        }),
      }).catch(err => console.warn("[플랫폼 알림 실패]", err.message));
      // 플랫폼 호출은 fire-and-forget — 실패해도 수주 업데이트는 성공
    }
  }

  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await pool.execute("DELETE FROM orders WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

export default router;
