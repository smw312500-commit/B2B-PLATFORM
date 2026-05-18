/**
 * EASTWOO 발주 데모 시드 스크립트
 * 실행: node seed-eastwoo.js  (server/ 디렉터리에서)
 *
 * - 이스트우드 발주 20건 / 총 700,000장 / 납기 6월 중
 * - 원자재 재고는 필요량의 70% (30% 부족)
 * - 기존 데이터 전체 초기화 후 삽입
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const forceReset = process.argv.includes("--force");

if (!forceReset) {
  console.error("This script deletes existing data in mes.db.");
  console.error("Re-run with: node seed-eastwoo.js --force");
  process.exit(1);
}

const sqlite = new Database(join(__dirname, "mes.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ─── 유틸 ────────────────────────────────────────────────────
const iso = (dateStr, hour = 9, min = 0) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

// ─── completed_at 컬럼 마이그레이션 (없으면 추가) ─────────────
try { sqlite.exec("ALTER TABLE orders ADD COLUMN completed_at TEXT"); } catch {}

// ─── 기존 데이터 전체 초기화 ──────────────────────────────────
console.log("기존 데이터 초기화 중...");
sqlite.exec(`
  DELETE FROM event_logs;
  DELETE FROM second_process_sessions;
  DELETE FROM first_process_sessions;
  DELETE FROM raw_stock_receipts;
  DELETE FROM orders;
`);

// ─── 발주 20건 (이스트우드, 총 700,000장, 납기 6월) ───────────
console.log("이스트우드 발주 데이터 삽입...");

/*
 재료 계산 기준:
   CARE_LABEL  374,000장 → 원단 163롤 / 칩 374,900 필요
   STICKER_LABEL 326,000장 → 스티커지 41롤 / 칩 328,000 필요
   칩 합계: 702,900개 필요
   30% 부족 = 원단 114롤 / 스티커지 29롤 / 칩 492,000 입고
*/

const orders = [
  // ── 접수 완료 (RECEIVED) ─ 먼저 들어온 건 ──
  { id:"ORD26050101", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:45000, jobType:"GENERAL", cutting:"Y", priority:1, status:"RECEIVED", dueDate:"2026-06-05", createdAt:iso("2026-05-01") },
  { id:"ORD26050201", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:32000, jobType:"GENERAL", cutting:"N", priority:2, status:"RECEIVED", dueDate:"2026-06-06", createdAt:iso("2026-05-02",10) },
  { id:"ORD26050202", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:38000, jobType:"GENERAL", cutting:"Y", priority:2, status:"RECEIVED", dueDate:"2026-06-07", createdAt:iso("2026-05-02",14) },
  { id:"ORD26050301", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:27500, jobType:"SHORT",   cutting:"Y", priority:1, status:"RECEIVED", dueDate:"2026-06-08", createdAt:iso("2026-05-03") },
  { id:"ORD26050401", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:56000, jobType:"GENERAL", cutting:"N", priority:2, status:"RECEIVED", dueDate:"2026-06-10", createdAt:iso("2026-05-04") },
  { id:"ORD26050501", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:41000, jobType:"GENERAL", cutting:"N", priority:3, status:"RECEIVED", dueDate:"2026-06-11", createdAt:iso("2026-05-05") },
  // ── 발주 접수 (RECEIVED) ─ 최근 들어온 건 ──
  { id:"ORD26050601", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:24000, jobType:"GENERAL", cutting:"N", priority:2, status:"RECEIVED", dueDate:"2026-06-12", createdAt:iso("2026-05-06") },
  { id:"ORD26050701", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:19800, jobType:"SHORT",   cutting:"Y", priority:3, status:"RECEIVED", dueDate:"2026-06-13", createdAt:iso("2026-05-07") },
  { id:"ORD26050801", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:48000, jobType:"GENERAL", cutting:"N", priority:2, status:"RECEIVED", dueDate:"2026-06-14", createdAt:iso("2026-05-08",9) },
  { id:"ORD26050802", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:35200, jobType:"GENERAL", cutting:"Y", priority:1, status:"RECEIVED", dueDate:"2026-06-16", createdAt:iso("2026-05-08",13) },
  { id:"ORD26050901", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:16000, jobType:"SHORT",   cutting:"N", priority:3, status:"RECEIVED", dueDate:"2026-06-17", createdAt:iso("2026-05-09") },
  { id:"ORD26051001", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:52000, jobType:"GENERAL", cutting:"Y", priority:2, status:"RECEIVED", dueDate:"2026-06-18", createdAt:iso("2026-05-10",9) },
  { id:"ORD26051002", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:40000, jobType:"GENERAL", cutting:"N", priority:3, status:"RECEIVED", dueDate:"2026-06-20", createdAt:iso("2026-05-10",15) },
  { id:"ORD26051101", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:23600, jobType:"GENERAL", cutting:"Y", priority:2, status:"RECEIVED", dueDate:"2026-06-21", createdAt:iso("2026-05-11") },
  { id:"ORD26051201", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:64000, jobType:"GENERAL", cutting:"N", priority:1, status:"RECEIVED", dueDate:"2026-06-23", createdAt:iso("2026-05-12") },
  { id:"ORD26051301", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:17400, jobType:"SHORT",   cutting:"N", priority:3, status:"RECEIVED", dueDate:"2026-06-24", createdAt:iso("2026-05-13",9) },
  { id:"ORD26051302", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:30000, jobType:"GENERAL", cutting:"Y", priority:2, status:"RECEIVED", dueDate:"2026-06-25", createdAt:iso("2026-05-13",11) },
  { id:"ORD26051303", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:28000, jobType:"GENERAL", cutting:"N", priority:2, status:"RECEIVED", dueDate:"2026-06-26", createdAt:iso("2026-05-13",14) },
  { id:"ORD26051401", customerName:"EASTWOO", productType:"CARE_LABEL",    quantity:44500, jobType:"GENERAL", cutting:"Y", priority:1, status:"RECEIVED", dueDate:"2026-06-28", createdAt:iso("2026-05-14",9) },
  { id:"ORD26051402", customerName:"EASTWOO", productType:"STICKER_LABEL", quantity:18000, jobType:"GENERAL", cutting:"N", priority:3, status:"RECEIVED", dueDate:"2026-06-30", createdAt:iso("2026-05-14",11) },
];

const insertOrder = sqlite.prepare(`
  INSERT INTO orders
    (id, order_number, customer_name, product_type, quantity, job_type, cutting, priority, status, due_date, created_at, completed_at)
  VALUES
    (@id, @id, @customerName, @productType, @quantity, @jobType, @cutting, @priority, @status, @dueDate, @createdAt, NULL)
`);
for (const o of orders) insertOrder.run(o);

const totalQty = orders.reduce((s, o) => s + o.quantity, 0);
const careQty   = orders.filter(o => o.productType === "CARE_LABEL").reduce((s, o) => s + o.quantity, 0);
const stickerQty = orders.filter(o => o.productType === "STICKER_LABEL").reduce((s, o) => s + o.quantity, 0);

console.log(`  발주 ${orders.length}건 삽입 완료`);
console.log(`  총 수량: ${totalQty.toLocaleString()}장 (케어라벨 ${careQty.toLocaleString()} / 스티커 ${stickerQty.toLocaleString()})`);

// ─── 원자재 입고 (필요량의 70% — 30% 부족 시나리오) ────────────
console.log("\n원자재 입고 데이터 삽입 (30% 부족 시나리오)...");

/*
 필요량 계산:
   원단:    ceil(374000/2300) = 163롤 → 70% = 114롤 입고
   칩:      702,900개         → 70% = 492,000개 입고
   스티커지: ceil(326000/8000) = 41롤  → 70% = 29롤 입고

 부족률:
   원단:    (163-114)/163  = 30.1%
   칩:      (702900-492000)/702900 = 30.0%
   스티커지: (41-29)/41    = 29.3%
*/

const rawStocks = [
  // FABRIC — 필요 163롤, 입고 114롤 (부족 30.1%)
  { materialType:"FABRIC",        quantity:70,      receivedDate:"2026-05-02", note:"5월 정기 입고 1차" },
  { materialType:"FABRIC",        quantity:44,      receivedDate:"2026-05-09", note:"5월 정기 입고 2차" },
  // CHIP — 필요 702,900개, 입고 492,000개 (부족 30.0%)
  { materialType:"CHIP",          quantity:300000,  receivedDate:"2026-05-01", note:"5월 칩 입고 1차" },
  { materialType:"CHIP",          quantity:192000,  receivedDate:"2026-05-10", note:"5월 칩 입고 2차" },
  // STICKER_PAPER — 필요 41롤, 입고 29롤 (부족 29.3%)
  { materialType:"STICKER_PAPER", quantity:20,      receivedDate:"2026-05-03", note:"5월 스티커지 입고 1차" },
  { materialType:"STICKER_PAPER", quantity:9,       receivedDate:"2026-05-11", note:"5월 스티커지 입고 2차" },
];

const insertRaw = sqlite.prepare(`
  INSERT INTO raw_stock_receipts (material_type, quantity, received_date, note, created_at)
  VALUES (@materialType, @quantity, @receivedDate, @note, @createdAt)
`);
for (const r of rawStocks) {
  insertRaw.run({ ...r, createdAt: iso(r.receivedDate) });
  // 이벤트 로그도 기록
  sqlite.prepare(`
    INSERT INTO event_logs (event_type, qty, material_type, timestamp, note)
    VALUES ('MATERIAL_RECEIPT', @qty, @materialType, @timestamp, @note)
  `).run({ qty: r.quantity, materialType: r.materialType, timestamp: iso(r.receivedDate), note: r.note });
}

const fabricTotal   = rawStocks.filter(r => r.materialType === "FABRIC").reduce((s, r) => s + r.quantity, 0);
const chipTotal     = rawStocks.filter(r => r.materialType === "CHIP").reduce((s, r) => s + r.quantity, 0);
const stickerTotal  = rawStocks.filter(r => r.materialType === "STICKER_PAPER").reduce((s, r) => s + r.quantity, 0);

console.log(`  원단:    163롤 필요 → ${fabricTotal}롤 입고 (부족 ${(((163-fabricTotal)/163)*100).toFixed(1)}%)`);
console.log(`  칩:      702,900개 필요 → ${chipTotal.toLocaleString()}개 입고 (부족 ${(((702900-chipTotal)/702900)*100).toFixed(1)}%)`);
console.log(`  스티커지: 41롤 필요 → ${stickerTotal}롤 입고 (부족 ${(((41-stickerTotal)/41)*100).toFixed(1)}%)`);

console.log("\n✅ EASTWOO 시드 데이터 삽입 완료!");
console.log(`  발주: ${orders.length}건 / 총 ${totalQty.toLocaleString()}장`);
console.log("  납기: 2026-06-05 ~ 2026-06-30");
console.log("  재고: 필요량 대비 약 30% 부족 상태");

sqlite.close();
