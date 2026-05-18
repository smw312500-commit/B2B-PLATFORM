import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || "localhost",
  port:     Number(process.env.MYSQL_PORT) || 3306,
  user:     process.env.MYSQL_USER     || "root",
  password: process.env.MYSQL_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

export async function initDb() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log("✅ MySQL 연결 완료 (platform)");
}
