import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

import express from "express";
import cors from "cors";
import { initDb } from "./db/index.js";
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
