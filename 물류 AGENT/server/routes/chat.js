import { Router } from "express";
import OpenAI from "openai";
import { pool } from "../db/index.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message, context, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message가 필요합니다." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });

  const [allVehicles]   = await pool.execute("SELECT * FROM vehicles");
  const [allRequests]   = await pool.execute("SELECT * FROM dispatch_requests");
  const [allDispatches] = await pool.execute("SELECT * FROM dispatches");
  const [recentLogs]    = await pool.execute("SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT 50");

  const available = allVehicles.filter(v => v.status === "AVAILABLE").length;
  const onDuty    = allVehicles.filter(v => v.status === "ON_DUTY").length;
  const pending   = allRequests.filter(r => r.status === "PENDING").length;
  const inTransit = allDispatches.filter(d => d.status === "IN_TRANSIT").length;
  const delivered = allDispatches.filter(d => d.status === "DELIVERED").length;

  const systemPrompt = `당신은 물류 배차 AI 어시스턴트입니다. 항상 한국어로 답변하세요.

[현재 현황]
- 차량: 총 ${allVehicles.length}대 (가용 ${available}대 / 운행 중 ${onDuty}대)
- 배차 요청: 대기 ${pending}건
- 배차: 운송 중 ${inTransit}건 / 완료 ${delivered}건

[대시보드]
${JSON.stringify(context ?? {}, null, 2)}

[최근 이벤트 (50건)]
${recentLogs.map(l => `[${String(l.timestamp).slice(0,16)}] ${l.event_type} | ${l.note ?? ""}`).join("\n") || "없음"}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.filter(h => h.text?.trim()).map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text })),
        { role: "user", content: message },
      ],
      max_tokens: 1024,
    });
    res.json({ reply: completion.choices[0]?.message?.content?.trim() ?? "응답 생성 실패" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
