import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });

  try {
    const openai = new OpenAI({ apiKey });
    let content;

    if (req.file.mimetype === "application/pdf") {
      // PDF → 텍스트 추출 → GPT 파싱
      const pdfData = await pdfParse(req.file.buffer);
      const pdfText = pdfData.text?.slice(0, 4000) || "";

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `아래 B/L(선하증권) 텍스트에서 정보를 추출해 JSON으로만 반환하세요.
자재 종류는 CHIP(전자칩/IC칩/RFID), FABRIC(원단/직물/Fabric/Nylon), STICKER_PAPER(스티커지/라벨지/Label Paper) 중 하나로 분류하세요.
수량 단위: CHIP=개(pcs), FABRIC=롤(rolls), STICKER_PAPER=롤(rolls).

반환 형식:
{
  "blNumber": "BL번호",
  "vessel": "선박명",
  "originPort": "선적항",
  "destinationPort": "양하항",
  "pickupAddress": "픽업장소(도착항+부두)",
  "deliveryAddress": "배달장소(수하인주소)",
  "eta": "YYYY-MM-DD",
  "items": [{ "type": "CHIP|FABRIC|STICKER_PAPER", "qty": 숫자, "description": "원문품목명" }]
}

B/L 텍스트:
${pdfText}`
        }],
        response_format: { type: "json_object" },
        max_tokens: 1024,
      });

      content = JSON.parse(completion.choices[0].message.content);
    } else {
      // 이미지 → GPT-4o Vision
      const base64 = req.file.buffer.toString("base64");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64}` } },
            { type: "text", text: `이 B/L 이미지에서 정보를 추출해 JSON으로만 반환하세요.
자재 종류: CHIP(전자칩/RFID), FABRIC(원단/직물), STICKER_PAPER(스티커지/라벨지)
{ "blNumber":"", "vessel":"", "originPort":"", "destinationPort":"", "pickupAddress":"", "deliveryAddress":"", "eta":"YYYY-MM-DD", "items":[{"type":"","qty":0,"description":""}] }` }
          ]
        }],
        response_format: { type: "json_object" },
        max_tokens: 1024,
      });

      content = JSON.parse(completion.choices[0].message.content);
    }

    if (!content?.items?.length) return res.status(422).json({ error: "품목을 찾을 수 없습니다." });
    res.json(content);
  } catch (err) {
    console.error("B/L 파싱 오류:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
