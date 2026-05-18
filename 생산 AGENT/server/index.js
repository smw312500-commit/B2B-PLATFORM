import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

import express from "express";
import cors from "cors";
import { initDb } from "./db/index.js";
import ordersRouter       from "./routes/orders.js";
import rawStocksRouter    from "./routes/rawStocks.js";
import firstProcessRouter from "./routes/firstProcess.js";
import secondProcessRouter from "./routes/secondProcess.js";
import eventLogsRouter    from "./routes/eventLogs.js";
import chatRouter         from "./routes/chat.js";
import blImportsRouter    from "./routes/blImports.js";
import blParseRouter      from "./routes/blParse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

await initDb();

app.use("/api/orders",         ordersRouter);
app.use("/api/raw-stocks",     rawStocksRouter);
app.use("/api/first-process",  firstProcessRouter);
app.use("/api/second-process", secondProcessRouter);
app.use("/api/event-logs",     eventLogsRouter);
app.use("/api/chat",           chatRouter);
app.use("/api/bl-imports",    blImportsRouter);
app.use("/api/bl-parse",      blParseRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const distPath = join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, () => console.log(`🚀 EM 서버 실행 중: http://localhost:${PORT}`));
