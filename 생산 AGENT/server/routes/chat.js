import { Router } from "express";
import OpenAI from "openai";
import { pool } from "../db/index.js";

const router = Router();

const EVENT_TYPE_KO = {
  MATERIAL_RECEIPT:"원자재 입고", FIRST_PROCESS_START:"1차공정 시작",
  FIRST_PROCESS_DONE:"1차공정 완료", DEFECT_STOP:"공정불량 중단",
  SHORT_RECORD:"불량(쇼트) 기록", FIRST_TO_SECOND:"1차→2차 투입",
  SECOND_PROCESS_DONE:"2차공정 완료", WORK_START:"작업 시작",
  WORK_DONE:"작업 완료", PROCESS_DEFECT:"공정불량",
};
const MATERIAL_KO = { CHIP:"칩", FABRIC:"원단", STICKER_PAPER:"스티커지" };

router.post("/", async (req, res) => {
  const { message, context, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message가 필요합니다." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });

  const [allLogs] = await pool.execute("SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT 500");
  const logs = allLogs.slice(0, 50);

  const logsText = logs.length > 0
    ? logs.map(l => {
        const parts = [`[${String(l.timestamp).slice(0, 16)}]`, EVENT_TYPE_KO[l.event_type] ?? l.event_type];
        if (l.order_id)      parts.push(`오더:${l.order_id}`);
        if (l.session_type)  parts.push(`공정:${l.session_type === "FIRST" ? "1차" : "2차"}`);
        if (l.machine_id)    parts.push(`기계:${l.machine_id}호`);
        if (l.qty != null)   parts.push(`수량:${l.qty.toLocaleString()}`);
        if (l.material_type) parts.push(`자재:${MATERIAL_KO[l.material_type] ?? l.material_type}`);
        if (l.note)          parts.push(`메모:${l.note}`);
        return parts.join(" | ");
      }).join("\n")
    : "기록된 이벤트 로그가 없습니다.";

  const eventCounts = {};
  let totalShortQty = 0, totalSecondDoneQty = 0;
  allLogs.forEach(l => {
    eventCounts[l.event_type] = (eventCounts[l.event_type] ?? 0) + 1;
    if (l.event_type === "SHORT_RECORD" && l.qty) totalShortQty += l.qty;
    if (l.event_type === "SECOND_PROCESS_DONE" && l.qty) totalSecondDoneQty += l.qty;
  });
  const shortRate = totalSecondDoneQty > 0
    ? ((totalShortQty / (totalSecondDoneQty + totalShortQty)) * 100).toFixed(1) : "0.0";

  const systemPrompt = `당신은 한국 의류 제조 공장의 MES AI 어시스턴트입니다. 항상 한국어로 답변하세요.

[이벤트 집계 (전체 ${allLogs.length}건)]
- 유형별: ${JSON.stringify(Object.fromEntries(Object.entries(eventCounts).map(([k,v]) => [EVENT_TYPE_KO[k] ?? k, v])))}
- 2차공정 생산 합계: ${totalSecondDoneQty.toLocaleString()}개 / 불량 합계: ${totalShortQty.toLocaleString()}개 / 쇼트율: ${shortRate}%

[대시보드 현황]
${JSON.stringify(context ?? {}, null, 2)}

[최근 이벤트 (${logs.length}건)]
${logsText}`;

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
