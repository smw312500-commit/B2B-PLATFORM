/**
 * 시드 스크립트 — 샘플 데이터 생성
 * 실행: node seed.js  (server/ 디렉터리에서)
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const forceReset = process.argv.includes("--force");

if (!forceReset) {
  console.error("This script deletes existing data in mes.db.");
  console.error("Re-run with: node seed.js --force");
  process.exit(1);
}

const sqlite = new Database(join(__dirname, "mes.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ─── 유틸 ─────────────────────────────────────────────────
const dt = (daysAgo, hour = 9, min = 0) => {
  const d = new Date("2026-04-17T00:00:00");
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString().replace("T", " ").slice(0, 16);
};
const date = (daysAgo) => {
  const d = new Date("2026-04-17T00:00:00");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const orderNum = (daysAgo, seq) => {
  const d = new Date("2026-04-17T00:00:00");
  d.setDate(d.getDate() - daysAgo);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `ORD${yy}${mm}${dd}${String(seq).padStart(2, "0")}`;
};

// ─── completed_at 컬럼 마이그레이션 (없으면 추가) ──────────
try { sqlite.exec("ALTER TABLE orders ADD COLUMN completed_at TEXT"); } catch {}

// ─── 기존 데이터 삭제 ──────────────────────────────────────
console.log("기존 데이터 초기화 중...");
sqlite.exec(`
  DELETE FROM event_logs;
  DELETE FROM second_process_sessions;
  DELETE FROM first_process_sessions;
  DELETE FROM raw_stock_receipts;
  DELETE FROM orders;
`);

// ─── 발주 (orders) ────────────────────────────────────────
console.log("발주 데이터 삽입...");
const orders = [
  // 완료된 발주
  { id: orderNum(30,1), status:"DONE",          productType:"CARE_LABEL",    quantity:23000, customerName:"한국패션㈜",    dueDate:date(18), jobType:"GENERAL", cutting:"Y", priority:1, completedAt:dt(16,17,30) },
  { id: orderNum(28,1), status:"DONE",          productType:"STICKER_LABEL", quantity:64000, customerName:"스타일리스트",  dueDate:date(15), jobType:"GENERAL", cutting:"N", priority:2, completedAt:dt(14,15, 0) },
  { id: orderNum(25,1), status:"DONE",          productType:"CARE_LABEL",    quantity:11500, customerName:"패션하우스",    dueDate:date(12), jobType:"SHORT",   cutting:"Y", priority:1, completedAt:dt(11,18, 0) },
  { id: orderNum(22,1), status:"DONE",          productType:"STICKER_LABEL", quantity:40000, customerName:"모던웨어",      dueDate:date(10), jobType:"GENERAL", cutting:"N", priority:3, completedAt:dt( 9,16,45) },
  { id: orderNum(20,1), status:"DONE",          productType:"CARE_LABEL",    quantity:34500, customerName:"한국패션㈜",    dueDate:date( 8), jobType:"GENERAL", cutting:"Y", priority:2, completedAt:dt( 7,17,20) },
  // 출고대기
  { id: orderNum(15,1), status:"READY_TO_SHIP", productType:"STICKER_LABEL", quantity:56000, customerName:"스타일리스트",  dueDate:date( 5), jobType:"GENERAL", cutting:"N", priority:1, completedAt:null },
  { id: orderNum(14,1), status:"READY_TO_SHIP", productType:"CARE_LABEL",    quantity:18400, customerName:"패션하우스",    dueDate:date( 4), jobType:"SHORT",   cutting:"Y", priority:2, completedAt:null },
  // 작업중 (IN_PROGRESS)
  { id: orderNum(10,1), status:"IN_PROGRESS",   productType:"CARE_LABEL",    quantity:27600, customerName:"한국패션㈜",    dueDate:date( 2), jobType:"GENERAL", cutting:"Y", priority:1, completedAt:null },
  { id: orderNum(10,2), status:"IN_PROGRESS",   productType:"STICKER_LABEL", quantity:48000, customerName:"모던웨어",      dueDate:date( 1), jobType:"GENERAL", cutting:"N", priority:2, completedAt:null },
  // 접수완료 (RECEIVED)
  { id: orderNum( 5,1), status:"RECEIVED",      productType:"CARE_LABEL",    quantity:13800, customerName:"패션하우스",    dueDate:date( 3), jobType:"GENERAL", cutting:"Y", priority:2, completedAt:null },
  // 접수 (ORDERED)
  { id: orderNum( 3,1), status:"ORDERED",       productType:"STICKER_LABEL", quantity:72000, customerName:"스타일리스트",  dueDate:date(-5), jobType:"GENERAL", cutting:"N", priority:3, completedAt:null },
  { id: orderNum( 2,1), status:"ORDERED",       productType:"CARE_LABEL",    quantity:9200,  customerName:"모던웨어",      dueDate:date(-3), jobType:"SHORT",   cutting:"Y", priority:1, completedAt:null },
];
const insertOrder = sqlite.prepare(`
  INSERT INTO orders (id,order_number,customer_name,product_type,quantity,job_type,cutting,priority,status,due_date,created_at,completed_at)
  VALUES (@id,@id,@customerName,@productType,@quantity,@jobType,@cutting,@priority,@status,@dueDate,@createdAt,@completedAt)
`);
for (const o of orders) {
  insertOrder.run({ ...o, createdAt: dt(30 - orders.indexOf(o), 9, 0) });
}

// ─── 원자재 입고 (raw_stock_receipts) ────────────────────
console.log("원자재 입고 데이터 삽입...");
const rawStocks = [
  { materialType:"FABRIC",        quantity:80,  receivedDate:date(35), note:"3월 정기 입고" },
  { materialType:"CHIP",          quantity:500000, receivedDate:date(35), note:"3월 정기 입고" },
  { materialType:"STICKER_PAPER", quantity:60,  receivedDate:date(35), note:"3월 정기 입고" },
  { materialType:"FABRIC",        quantity:40,  receivedDate:date(15), note:"추가 긴급 입고" },
  { materialType:"STICKER_PAPER", quantity:30,  receivedDate:date(12), note:"추가 입고" },
  { materialType:"CHIP",          quantity:200000, receivedDate:date(10), note:"소모 보충" },
];
const insertRaw = sqlite.prepare(`
  INSERT INTO raw_stock_receipts (material_type,quantity,received_date,note,created_at)
  VALUES (@materialType,@quantity,@receivedDate,@note,@createdAt)
`);
for (const r of rawStocks) insertRaw.run({ ...r, createdAt: dt(35) });

// ─── 이벤트 로그 헬퍼 ─────────────────────────────────────
const insertEvent = sqlite.prepare(`
  INSERT INTO event_logs (event_type,session_type,session_id,order_id,machine_id,qty,material_type,timestamp,note)
  VALUES (@eventType,@sessionType,@sessionId,@orderId,@machineId,@qty,@materialType,@timestamp,@note)
`);
const ev = (o) => insertEvent.run({
  eventType: null, sessionType: null, sessionId: null,
  orderId: null, machineId: null, qty: null,
  materialType: null, note: null, ...o,
});

// 원자재 입고 이벤트
for (const r of rawStocks) {
  ev({ eventType:"MATERIAL_RECEIPT", materialType:r.materialType, qty:r.quantity, timestamp:r.receivedDate+" 09:00" });
}

// ─── 1차 공정 세션 ────────────────────────────────────────
console.log("1차 공정 세션 삽입...");
const insertFirst = sqlite.prepare(`
  INSERT INTO first_process_sessions
    (order_id,process_type,work_date,target_qty,output_qty,short_qty,started_at,ended_at,status,created_at)
  VALUES
    (@orderId,@processType,@workDate,@targetQty,@outputQty,@shortQty,@startedAt,@endedAt,@status,@createdAt)
`);
const firstSessions = [
  // 완료된 발주용
  { orderId:orderNum(30,1), processType:"컨버팅",         workDate:date(29), targetQty:10, outputQty:10, shortQty:0, startedAt:dt(29, 8,0),  endedAt:dt(29,11,20), status:"DONE" },
  { orderId:orderNum(28,1), processType:"스티커 컨버팅",   workDate:date(27), targetQty: 8, outputQty: 8, shortQty:0, startedAt:dt(27, 8,0),  endedAt:dt(27,12, 0), status:"DONE" },
  { orderId:orderNum(25,1), processType:"컨버팅",         workDate:date(24), targetQty: 5, outputQty: 5, shortQty:1, startedAt:dt(24, 8,30), endedAt:dt(24,10,45), status:"DONE" },
  { orderId:orderNum(22,1), processType:"스티커 컨버팅",   workDate:date(21), targetQty: 5, outputQty: 5, shortQty:0, startedAt:dt(21, 9, 0), endedAt:dt(21,11,30), status:"DONE" },
  { orderId:orderNum(20,1), processType:"컨버팅",         workDate:date(19), targetQty:15, outputQty:15, shortQty:0, startedAt:dt(19, 8, 0), endedAt:dt(19,13, 0), status:"DONE" },
  // 출고대기 발주용
  { orderId:orderNum(15,1), processType:"스티커 컨버팅",   workDate:date(14), targetQty: 7, outputQty: 7, shortQty:0, startedAt:dt(14, 8, 0), endedAt:dt(14,11, 0), status:"DONE" },
  { orderId:orderNum(14,1), processType:"컨버팅",         workDate:date(13), targetQty: 8, outputQty: 8, shortQty:2, startedAt:dt(13, 8,30), endedAt:dt(13,12,30), status:"DONE" },
  // 작업중 발주용 (1차는 완료, 2차 진행중)
  { orderId:orderNum(10,1), processType:"컨버팅",         workDate:date( 9), targetQty:12, outputQty:12, shortQty:0, startedAt:dt( 9, 8, 0), endedAt:dt( 9,12, 0), status:"DONE" },
  { orderId:orderNum(10,2), processType:"스티커 컨버팅",   workDate:date( 8), targetQty: 6, outputQty: 6, shortQty:0, startedAt:dt( 8, 8, 0), endedAt:dt( 8,11, 0), status:"DONE" },
];
const firstIds = [];
for (const s of firstSessions) {
  const res = insertFirst.run({ ...s, createdAt: s.startedAt });
  firstIds.push(res.lastInsertRowid);
  // 이벤트: 1차 시작
  ev({ eventType:"FIRST_PROCESS_START", sessionType:"FIRST", sessionId:res.lastInsertRowid, orderId:s.orderId, qty:s.targetQty, timestamp:s.startedAt });
  // 공정불량 이벤트 (쇼트 있는 경우)
  if (s.shortQty > 0) {
    ev({ eventType:"DEFECT_STOP", sessionType:"FIRST", sessionId:res.lastInsertRowid, orderId:s.orderId, qty:s.shortQty, timestamp:s.startedAt.replace("08:30","09:45").replace("08:00","10:20"), note:"원단 불량" });
  }
  // 이벤트: 1차 완료
  ev({ eventType:"FIRST_PROCESS_DONE", sessionType:"FIRST", sessionId:res.lastInsertRowid, orderId:s.orderId, qty:s.outputQty, timestamp:s.endedAt });
  // 이벤트: 1차→2차 투입
  ev({ eventType:"FIRST_TO_SECOND", sessionType:"FIRST", sessionId:res.lastInsertRowid, orderId:s.orderId, qty:s.outputQty, timestamp:s.endedAt });
}

// ─── 2차 공정 세션 ────────────────────────────────────────
console.log("2차 공정 세션 삽입...");
const insertSecond = sqlite.prepare(`
  INSERT INTO second_process_sessions
    (order_id,machine_id,process_type,units_per_hour,work_date,target_qty,output_qty,short_qty,work_minutes,started_at,ended_at,status,created_at)
  VALUES
    (@orderId,@machineId,@processType,@unitsPerHour,@workDate,@targetQty,@outputQty,@shortQty,@workMinutes,@startedAt,@endedAt,@status,@createdAt)
`);
const secondSessions = [
  // 완료 세션 (과거 발주)
  { orderId:orderNum(30,1), machineId:1, processType:"care_label",    unitsPerHour:2300, workDate:date(17), targetQty:23000, outputQty:22540, shortQty: 460, workMinutes:600, startedAt:dt(17, 8, 0), endedAt:dt(17,18, 0), status:"DONE" },
  { orderId:orderNum(28,1), machineId:2, processType:"sticker_label", unitsPerHour:8000, workDate:date(14), targetQty:64000, outputQty:63200, shortQty: 800, workMinutes:480, startedAt:dt(14, 8, 0), endedAt:dt(14,16, 0), status:"DONE" },
  { orderId:orderNum(25,1), machineId:1, processType:"care_label",    unitsPerHour:2300, workDate:date(11), targetQty:11500, outputQty:11040, shortQty: 460, workMinutes:300, startedAt:dt(11, 9, 0), endedAt:dt(11,14, 0), status:"DONE" },
  { orderId:orderNum(22,1), machineId:3, processType:"sticker_label", unitsPerHour:8000, workDate:date( 9), targetQty:40000, outputQty:39200, shortQty: 800, workMinutes:300, startedAt:dt( 9, 8, 0), endedAt:dt( 9,13, 0), status:"DONE" },
  { orderId:orderNum(20,1), machineId:1, processType:"care_label",    unitsPerHour:2300, workDate:date( 7), targetQty:34500, outputQty:33580, shortQty: 920, workMinutes:540, startedAt:dt( 7, 8, 0), endedAt:dt( 7,17, 0), status:"DONE" },
  // 출고대기용
  { orderId:orderNum(15,1), machineId:2, processType:"sticker_label", unitsPerHour:8000, workDate:date( 5), targetQty:56000, outputQty:55200, shortQty: 800, workMinutes:420, startedAt:dt( 5, 8, 0), endedAt:dt( 5,15, 0), status:"DONE" },
  { orderId:orderNum(14,1), machineId:4, processType:"care_label",    unitsPerHour:2300, workDate:date( 4), targetQty:18400, outputQty:17940, shortQty: 460, workMinutes:480, startedAt:dt( 4, 8, 0), endedAt:dt( 4,16, 0), status:"DONE" },
  // 작업중 발주 — 진행중 세션
  { orderId:orderNum(10,1), machineId:1, processType:"care_label",    unitsPerHour:2300, workDate:date( 1), targetQty:27600, outputQty:null,  shortQty:null, workMinutes:null, startedAt:dt( 1, 8, 0), endedAt:null, status:"IN_PROGRESS" },
  { orderId:orderNum(10,2), machineId:2, processType:"sticker_label", unitsPerHour:8000, workDate:date( 0), targetQty:48000, outputQty:null,  shortQty:null, workMinutes:null, startedAt:dt( 0, 8, 0), endedAt:null, status:"IN_PROGRESS" },
];
for (const s of secondSessions) {
  const res = insertSecond.run({ ...s, createdAt: s.startedAt });
  const sid = res.lastInsertRowid;
  // 이벤트: 2차 시작
  ev({ eventType:"WORK_START", sessionType:"SECOND", sessionId:sid, orderId:s.orderId, machineId:s.machineId, qty:s.targetQty, timestamp:s.startedAt });
  if (s.status === "DONE") {
    // 쇼트 이벤트
    if (s.shortQty > 0) {
      const shortTs = s.startedAt.slice(0,11) + "11:30";
      ev({ eventType:"SHORT_RECORD", sessionType:"SECOND", sessionId:sid, orderId:s.orderId, machineId:s.machineId, qty:s.shortQty, timestamp:shortTs, note:"인쇄 불량" });
    }
    // 완료 이벤트
    ev({ eventType:"SECOND_PROCESS_DONE", sessionType:"SECOND", sessionId:sid, orderId:s.orderId, machineId:s.machineId, qty:s.outputQty, timestamp:s.endedAt });
  }
}

// ─── 추가 이벤트: 공정불량 재시작 사례 ──────────────────────
ev({ eventType:"DEFECT_STOP",         sessionType:"SECOND", sessionId:3, orderId:orderNum(25,1), machineId:1, qty:460,  timestamp:dt(11,10,30), note:"롤 인쇄 오프셋 불량" });
ev({ eventType:"DEFECT_STOP",         sessionType:"SECOND", sessionId:5, orderId:orderNum(20,1), machineId:1, qty:920,  timestamp:dt( 7,11, 0), note:"색상 번짐" });
ev({ eventType:"SHORT_RECORD",        sessionType:"SECOND", sessionId:1, orderId:orderNum(30,1), machineId:1, qty:230,  timestamp:dt(17,12,15), note:"재단 불량 추가" });

console.log("✅ 시드 데이터 삽입 완료!");
console.log(`  발주: ${orders.length}건`);
console.log(`  원자재 입고: ${rawStocks.length}건`);
console.log(`  1차 공정 세션: ${firstSessions.length}건`);
console.log(`  2차 공정 세션: ${secondSessions.length}건`);

const eventCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM event_logs").get();
console.log(`  이벤트 로그: ${eventCount.cnt}건`);

sqlite.close();
