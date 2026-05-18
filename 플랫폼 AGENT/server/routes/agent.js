import { Router } from "express";
import { pool } from "../db/index.js";
import OpenAI from "openai";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const WEIGHT = { FABRIC: 1.2, STICKER_PAPER: 1.3, CHIP: 1.5 / 50000 };

// ── Agent가 사용할 도구 정의 ─────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_logistics_dispatch",
      description: "출고 준비 또는 납기 임박 수주에 대해 물류 배차 요청을 자동 생성한다.",
      parameters: {
        type: "object",
        properties: {
          order_id:          { type: "string",  description: "수주 ID" },
          cargo_desc:        { type: "string",  description: "화물 설명" },
          qty:               { type: "number",  description: "수량" },
          weight_kg:         { type: "number",  description: "무게(kg)" },
          pickup_location:   { type: "string",  description: "픽업 장소" },
          delivery_location: { type: "string",  description: "배달 장소" },
          reason:            { type: "string",  description: "생성 이유" },
        },
        required: ["order_id", "cargo_desc", "pickup_location", "delivery_location", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_priority",
      description: "납기 리스크가 높은 수주의 우선순위를 조정한다.",
      parameters: {
        type: "object",
        properties: {
          order_id:     { type: "string" },
          new_priority: { type: "number", description: "1=최우선, 2=높음, 3=보통" },
          reason:       { type: "string" },
        },
        required: ["order_id", "new_priority", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_stockout_risk",
      description: "원자재 재고 부족 위험을 감지하고 경고를 기록한다.",
      parameters: {
        type: "object",
        properties: {
          material_type:    { type: "string",  description: "CHIP | FABRIC | STICKER_PAPER" },
          current_stock:    { type: "number" },
          required_qty:     { type: "number" },
          recommendation:   { type: "string" },
        },
        required: ["material_type", "current_stock", "required_qty", "recommendation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_return_trip",
      description: "배달 완료 후 공장 근처에 있는 차량을 귀로 화물 배차 요청에 추천한다. 직접 배차하지 않고 물류기업이 확인 후 배차하도록 추천 메모를 남긴다.",
      parameters: {
        type: "object",
        properties: {
          matched_request_id:        { type: "number", description: "귀로 추천 대상인 PENDING 배차 요청 ID" },
          recommended_vehicle_id:    { type: "number", description: "추천 차량 ID" },
          recommended_vehicle_plate: { type: "string", description: "추천 차량 번호판" },
          current_location:          { type: "string", description: "차량 현재 위치 (최근 배달지)" },
          reason:                    { type: "string", description: "추천 이유" },
        },
        required: ["matched_request_id", "recommended_vehicle_id", "reason"],
      },
    },
  },
];

// ── 도구 실행 함수 ───────────────────────────────────────────
async function executeTool(name, args) {
  const ts = now();

  if (name === "create_logistics_dispatch") {
    const { order_id, cargo_desc, qty, weight_kg, pickup_location, delivery_location, reason } = args;
    const [exists] = await pool.execute(
      "SELECT id FROM logistics_agent.dispatch_requests WHERE cargo_desc=? AND status='PENDING' AND pickup_location=?",
      [cargo_desc, pickup_location]
    );
    if (exists.length > 0) return { ok: false, message: "이미 동일한 배차 요청 존재" };
    await pool.execute(
      `INSERT INTO logistics_agent.dispatch_requests
         (request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location, status, requested_at)
       VALUES ('PRODUCTION',?,?,?,?,?,'PENDING',?)`,
      [cargo_desc, qty ?? null, weight_kg ?? null, pickup_location, delivery_location, ts]
    );
    await logAction("DISPATCH_AUTO_CREATED", `[${order_id}] ${cargo_desc} 배차 요청 자동 생성 — ${reason}`);
    return { ok: true, message: `배차 요청 생성: ${cargo_desc}` };
  }

  if (name === "update_order_priority") {
    const { order_id, new_priority, reason } = args;
    await pool.execute("UPDATE em_agent.orders SET priority=? WHERE id=?", [new_priority, order_id]);
    await logAction("PRIORITY_UPDATED", `[${order_id}] 우선순위 → ${new_priority} — ${reason}`);
    return { ok: true, message: `${order_id} 우선순위 ${new_priority}로 변경` };
  }

  if (name === "flag_stockout_risk") {
    const { material_type, current_stock, required_qty, recommendation } = args;
    await logAction("STOCKOUT_RISK",
      `[${material_type}] 재고 ${current_stock} / 필요 ${required_qty} — ${recommendation}`, "PRODUCTION");
    return { ok: true, message: `재고 부족 경고: ${material_type}` };
  }

  if (name === "match_return_trip") {
    const { matched_request_id, recommended_vehicle_id, recommended_vehicle_plate, current_location, reason } = args;
    const [reqs] = await pool.execute(
      "SELECT * FROM logistics_agent.dispatch_requests WHERE id=? AND status='PENDING'",
      [matched_request_id]
    );
    if (!reqs.length) return { ok: false, message: "해당 배차 요청 없음 (이미 배차됐거나 취소됨)" };

    // 배차 결정은 물류기업이 함 — 플랫폼은 추천 메모만 추가
    const plate = recommended_vehicle_plate ?? `차량#${recommended_vehicle_id}`;
    const memo  = `[귀로 추천] ${plate} — 현위치: ${current_location ?? "근처"} / ${reason}`;
    await pool.execute(
      "UPDATE logistics_agent.dispatch_requests SET note = ? WHERE id = ?",
      [memo, matched_request_id]
    );

    await logAction("RETURN_TRIP_SUGGESTED",
      `귀로 추천: 요청 #${matched_request_id} ← ${plate} (${current_location}) — ${reason}`, "LOGISTICS");
    return { ok: true, message: `귀로 추천 완료: 요청 #${matched_request_id} ← ${plate}` };
  }

  return { ok: false, message: "알 수 없는 도구" };
}

async function logAction(eventType, message, companyType = "PLATFORM") {
  const ts = now();
  await pool.execute(
    `INSERT INTO platform_agent.platform_logs (company_type, event_type, message, logged_at)
     VALUES (?,?,?,?)`,
    [companyType, eventType, message, ts]
  );
}

// ── 컨텍스트 수집 ────────────────────────────────────────────
async function gatherContext() {
  const today = new Date();
  const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const [urgentOrders] = await pool.execute(
    `SELECT id, order_number, customer_name, product_type, quantity, status, due_date, priority
     FROM em_agent.orders
     WHERE status NOT IN ('DONE','CANCELLED') AND due_date <= ?
     ORDER BY due_date`,
    [in7days]
  );

  const [allOrders] = await pool.execute(
    `SELECT product_type, SUM(quantity) as total_needed
     FROM em_agent.orders WHERE status NOT IN ('DONE','CANCELLED')
     GROUP BY product_type`
  );

  const [stocks] = await pool.execute(
    `SELECT material_type, SUM(quantity) as total
     FROM em_agent.raw_stock_receipts GROUP BY material_type`
  );

  const [sessions] = await pool.execute(
    `SELECT s.id, s.order_id, s.status, s.target_qty, s.output_qty, s.units_per_hour, s.started_at,
            o.product_type, o.customer_name, o.due_date
     FROM em_agent.second_process_sessions s
     JOIN em_agent.orders o ON o.id = s.order_id
     WHERE s.status = 'IN_PROGRESS'`
  );

  const [availVehicles] = await pool.execute(
    `SELECT id, plate_number, vehicle_type, capacity_kg, base_region, driver_name
     FROM logistics_agent.vehicles WHERE status = 'AVAILABLE'`
  );

  const [deliveredVehicles] = await pool.execute(
    `SELECT v.id, v.plate_number, v.base_region, v.driver_name,
            r.delivery_location AS last_delivery_location, d.actual_delivered_at
     FROM logistics_agent.dispatches d
     JOIN logistics_agent.vehicles v ON v.id = d.vehicle_id
     JOIN logistics_agent.dispatch_requests r ON r.id = d.request_id
     WHERE d.status = 'DELIVERED' AND v.status = 'AVAILABLE'
       AND d.actual_delivered_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)`
  );

  const [pendingRequests] = await pool.execute(
    `SELECT id, request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location
     FROM logistics_agent.dispatch_requests WHERE status = 'PENDING'`
  );

  const readyOrders = await pool.execute(
    `SELECT id, order_number, product_type, quantity, customer_name
     FROM em_agent.orders WHERE status = 'READY_TO_SHIP'`
  );

  return { urgentOrders, allOrders, stocks, sessions, availVehicles, deliveredVehicles, pendingRequests, readyOrders: readyOrders[0] };
}

// ── Agent 실행 ───────────────────────────────────────────────
router.post("/run", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY 없음" });

  const openai = new OpenAI({ apiKey });
  const ctx = await gatherContext();
  const ts = now();

  await logAction("AGENT_START", `에이전트 사이클 시작 — 납기임박 ${ctx.urgentOrders.length}건, 가용차량 ${ctx.availVehicles.length}대`);

  const systemPrompt = `당신은 B2B 물류-생산 플랫폼의 AI 에이전트입니다.
생산기업(EM)과 물류기업 데이터를 분석해 최적 운영 결정을 내리고 반드시 도구로 실행하세요.

역할:
1. 납기 D-7 이내 미착수 수주 → 우선순위 상향 + 물류 배차 준비
2. 출고대기(READY_TO_SHIP) 수주 → 물류 배차 요청 즉시 생성
3. 원자재 재고 vs 미완료 수주량 비교 → 부족 시 경고
4. 배달 완료 차량 감지 → 귀로 방향 대기 화물 자동 매칭
5. 분석만 하지 말고 반드시 도구를 호출해 실제 액션을 취하세요.`;

  const userMessage = `현재 시각: ${ts}

[납기 임박 수주 (D-7 이내)]
${ctx.urgentOrders.length ? ctx.urgentOrders.map(o =>
  `- ${o.id} | ${o.customer_name} | ${o.product_type} ${o.quantity.toLocaleString()}개 | 상태:${o.status} | 납기:${String(o.due_date).slice(0,10)} | 우선순위:${o.priority}`
).join("\n") : "없음"}

[출고 대기 수주]
${ctx.readyOrders.length ? ctx.readyOrders.map(o =>
  `- ${o.id} | ${o.product_type} ${o.quantity.toLocaleString()}개 | 고객:${o.customer_name}`
).join("\n") : "없음"}

[원자재 재고]
${ctx.stocks.map(s => `- ${s.material_type}: ${Number(s.total).toLocaleString()}`).join("\n")}

[미완료 수주 총 소요량]
${ctx.allOrders.map(o => `- ${o.product_type}: ${Number(o.total_needed).toLocaleString()}`).join("\n")}

[현재 생산 중인 세션]
${ctx.sessions.length ? ctx.sessions.map(s => {
  const remaining = (s.target_qty || 0) - (s.output_qty || 0);
  const etaHours = s.units_per_hour > 0 ? (remaining / s.units_per_hour).toFixed(1) : "?";
  return `- 세션#${s.id} | ${s.product_type} | 잔여:${remaining.toLocaleString()}개 | 완료예상:${etaHours}시간 후`;
}).join("\n") : "없음"}

[가용 차량]
${ctx.availVehicles.length ? ctx.availVehicles.map(v =>
  `- id:${v.id} | ${v.plate_number} | ${v.vehicle_type} ${v.capacity_kg.toLocaleString()}kg | 거점:${v.base_region ?? "미지정"} | 기사:${v.driver_name}`
).join("\n") : "없음"}

[최근 배달 완료 차량 (3시간 이내, 귀로 매칭 대상)]
${ctx.deliveredVehicles.length ? ctx.deliveredVehicles.map(v =>
  `- id:${v.id} | ${v.plate_number} | 현재위치:${v.last_delivery_location ?? v.base_region} | 거점:${v.base_region}`
).join("\n") : "없음"}

[배차 대기 중인 요청]
${ctx.pendingRequests.length ? ctx.pendingRequests.map(r =>
  `- id:${r.id} | ${r.cargo_desc} | ${r.pickup_location} → ${r.delivery_location} | ${r.weight_kg}kg`
).join("\n") : "없음"}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMessage },
  ];

  const actions = [];
  let iterations = 0;

  while (iterations < 5) {
    iterations++;
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 2048,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls?.length) break;

    const toolResults = [];
    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      const result = await executeTool(tc.function.name, args);
      actions.push({ tool: tc.function.name, args, result });
      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
    messages.push(...toolResults);
  }

  const finalMsg = messages.filter(m => m.role === "assistant" && !m.tool_calls?.length).pop();
  const summary = finalMsg?.content ?? "에이전트 실행 완료";

  await logAction("AGENT_DONE", `완료 — ${actions.length}개 액션 실행. ${summary.slice(0, 200)}`);

  res.json({ summary, actions, executedAt: ts });
});

// ── Agent 로그 조회 ──────────────────────────────────────────
router.get("/logs", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM platform_agent.platform_logs ORDER BY logged_at DESC LIMIT 100"
  );
  res.json(rows);
});

// ── 현재 상황 요약 ────────────────────────────────────────────
router.get("/status", async (req, res) => {
  const ctx = await gatherContext();
  res.json(ctx);
});

export default router;
