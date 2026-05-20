import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

import express from "express";
import cors from "cors";
import { initDb, pool } from "./db/index.js";
import vehiclesRouter         from "./routes/vehicles.js";
import dispatchRequestsRouter from "./routes/dispatchRequests.js";
import dispatchesRouter       from "./routes/dispatches.js";
import chatRouter             from "./routes/chat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

await initDb();

app.use("/api/vehicles",          vehiclesRouter);
app.use("/api/dispatch-requests", dispatchRequestsRouter);
app.use("/api/dispatches",        dispatchesRouter);
app.use("/api/chat",              chatRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "logistics" }));

app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: err.message });
});

const distPath = join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, () => console.log(`🚛 물류 서버 실행 중: http://localhost:${PORT}`));

// ── 자동 배차 상태 전환 (1분마다) ────────────────────────────
async function autoAdvanceDispatches() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    // ASSIGNED → IN_TRANSIT (픽업 예정 시각 지남)
    const [toTransit] = await pool.execute(
      `SELECT d.id, d.vehicle_id, d.request_id FROM dispatches d
       WHERE d.status = 'ASSIGNED' AND d.estimated_pickup IS NOT NULL AND d.estimated_pickup <= ?`,
      [now]
    );
    for (const d of toTransit) {
      await pool.execute("UPDATE dispatches SET status='IN_TRANSIT' WHERE id=?", [d.id]);
      await pool.execute(
        "INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note) VALUES (?,?,?,?,?,?)",
        ["STATUS_CHANGED", d.id, d.vehicle_id, d.request_id, now, "자동 전환: 픽업 시각 도래 → 운송 중"]
      );
      console.log(`[자동전환] 배차 #${d.id} ASSIGNED → IN_TRANSIT`);
    }

    // IN_TRANSIT → DELIVERED (도착 예정 시각 지남)
    const [toDelivered] = await pool.execute(
      `SELECT d.id, d.vehicle_id, d.request_id FROM dispatches d
       WHERE d.status = 'IN_TRANSIT' AND d.estimated_delivery IS NOT NULL AND d.estimated_delivery <= ?`,
      [now]
    );
    for (const d of toDelivered) {
      await pool.execute(
        "UPDATE dispatches SET status='DELIVERED', actual_delivered_at=? WHERE id=?",
        [now, d.id]
      );
      await pool.execute("UPDATE vehicles SET status='AVAILABLE' WHERE id=?", [d.vehicle_id]);
      await pool.execute("UPDATE dispatch_requests SET status='COMPLETED' WHERE id=?", [d.request_id]);
      await pool.execute(
        "INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note) VALUES (?,?,?,?,?,?)",
        ["STATUS_CHANGED", d.id, d.vehicle_id, d.request_id, now, "자동 전환: 도착 시각 도래 → 배달 완료"]
      );
      console.log(`[자동전환] 배차 #${d.id} IN_TRANSIT → DELIVERED, 차량 #${d.vehicle_id} AVAILABLE`);
    }
  } catch (err) {
    console.error("[자동전환 오류]", err.message);
  }
}

setInterval(autoAdvanceDispatches, 60 * 1000);
autoAdvanceDispatches(); // 서버 시작 시 즉시 1회 실행
