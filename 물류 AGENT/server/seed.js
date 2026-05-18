/**
 * 물류 시드 스크립트
 * 실행: node seed.js  (server/ 디렉터리에서)
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlite = new Database(join(__dirname, "logistics.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// 테이블 생성 (없으면)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, plate_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL, capacity_kg INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', driver_name TEXT NOT NULL,
    driver_phone TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dispatch_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, request_type TEXT NOT NULL,
    cargo_desc TEXT NOT NULL, qty INTEGER, weight_kg REAL,
    pickup_location TEXT NOT NULL, delivery_location TEXT NOT NULL,
    requested_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING'
  );
  CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER, vehicle_id INTEGER,
    assigned_at TEXT NOT NULL, estimated_pickup TEXT, estimated_delivery TEXT,
    actual_delivered_at TEXT, status TEXT NOT NULL DEFAULT 'ASSIGNED', note TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL,
    dispatch_id INTEGER, vehicle_id INTEGER, request_id INTEGER,
    timestamp TEXT NOT NULL, note TEXT
  );
`);

console.log("기존 데이터 초기화...");
sqlite.exec(`
  DELETE FROM event_logs; DELETE FROM dispatches;
  DELETE FROM dispatch_requests; DELETE FROM vehicles;
`);

// ─── 차량 5대 ─────────────────────────────────────────────────
const insertVehicle = sqlite.prepare(`
  INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, status, driver_name, driver_phone, created_at)
  VALUES (@plateNumber, @vehicleType, @capacityKg, @status, @driverName, @driverPhone, @createdAt)
`);

const vehicleList = [
  { plateNumber: "서울 12가 3456", vehicleType: "5TON",  capacityKg: 5000,  status: "AVAILABLE",  driverName: "김민준", driverPhone: "010-1234-5678" },
  { plateNumber: "경기 34나 7890", vehicleType: "11TON", capacityKg: 11000, status: "AVAILABLE",  driverName: "이수현", driverPhone: "010-2345-6789" },
  { plateNumber: "인천 56다 1234", vehicleType: "25TON", capacityKg: 25000, status: "ON_DUTY",    driverName: "박정호", driverPhone: "010-3456-7890" },
  { plateNumber: "부산 78라 5678", vehicleType: "5TON",  capacityKg: 5000,  status: "AVAILABLE",  driverName: "최서연", driverPhone: "010-4567-8901" },
  { plateNumber: "대구 90마 9012", vehicleType: "1TON",  capacityKg: 1000,  status: "MAINTENANCE", driverName: "정태양", driverPhone: "010-5678-9012" },
];

const now = new Date().toISOString();
vehicleList.forEach(v => insertVehicle.run({ ...v, createdAt: now }));

// ─── 배차 요청 4건 (PENDING) ──────────────────────────────────
const insertReq = sqlite.prepare(`
  INSERT INTO dispatch_requests (request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location, requested_at, status)
  VALUES (@requestType, @cargoDesc, @qty, @weightKg, @pickupLocation, @deliveryLocation, @requestedAt, @status)
`);

const requests = [
  { requestType:"IMPORT",     cargoDesc:"나일론 태피터 원단",  qty:200,    weightKg:24000, pickupLocation:"부산항 3부두",     deliveryLocation:"서울 금천구 공장",    requestedAt:"2026-05-21T09:00:00.000Z", status:"PENDING" },
  { requestType:"IMPORT",     cargoDesc:"라벨 스티커지",       qty:30,     weightKg:12600, pickupLocation:"부산항 3부두",     deliveryLocation:"서울 금천구 공장",    requestedAt:"2026-05-21T09:05:00.000Z", status:"PENDING" },
  { requestType:"IMPORT",     cargoDesc:"RFID 칩",            qty:500000, weightKg:3200,  pickupLocation:"부산항 3부두",     deliveryLocation:"서울 금천구 공장",    requestedAt:"2026-05-21T09:10:00.000Z", status:"PENDING" },
  { requestType:"PRODUCTION", cargoDesc:"케어라벨 출고",       qty:45000,  weightKg:180,   pickupLocation:"서울 금천구 공장", deliveryLocation:"서울 성동구 이스트우드 물류센터", requestedAt:"2026-05-14T14:00:00.000Z", status:"ASSIGNED" },
];

const ids = [];
requests.forEach(r => {
  const res = insertReq.run(r);
  ids.push(Number(res.lastInsertRowid));
});

// ─── 배차 1건 (ASSIGNED — 4번째 요청) ────────────────────────
sqlite.prepare(`
  INSERT INTO dispatches (request_id, vehicle_id, assigned_at, estimated_pickup, estimated_delivery, status, note, created_at)
  VALUES (?, ?, ?, ?, ?, 'ASSIGNED', 'AI 자동 배차', ?)
`).run(ids[3], 1, "2026-05-14T14:05:00.000Z", "2026-05-14T15:00:00.000Z", "2026-05-14T18:00:00.000Z", "2026-05-14T14:05:00.000Z");

sqlite.prepare(`UPDATE vehicles SET status='ON_DUTY' WHERE id=1`).run();

sqlite.prepare(`
  INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note)
  VALUES ('DISPATCH_ASSIGNED', 1, 1, ?, ?, 'AI 자동 배차 — 5톤 김민준 기사')
`).run(ids[3], "2026-05-14T14:05:00.000Z");

console.log("✅ 물류 시드 완료!");
console.log(`  차량: ${vehicleList.length}대`);
console.log(`  배차 요청: ${requests.length}건 (PENDING 3건 / ASSIGNED 1건)`);
sqlite.close();
