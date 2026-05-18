import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

import express from "express";
import cors from "cors";
import { initDb } from "./db/index.js";
import monitorRouter from "./routes/monitor.js";
import agentRouter   from "./routes/agent.js";
import notifyRouter  from "./routes/notify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

await initDb();

app.use("/api/monitor", monitorRouter);
app.use("/api/agent",   agentRouter);
app.use("/api/notify",  notifyRouter);
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "platform" }));

const distPath = join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, () => console.log(`플랫폼 서버 실행 중: http://localhost:${PORT}`));

