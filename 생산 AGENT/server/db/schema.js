import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── 수주 ────────────────────────────────────────────────
export const orders = sqliteTable("orders", {
  id:           text("id").primaryKey(),
  orderNumber:  text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  productType:  text("product_type").notNull(),   // CARE_LABEL | STICKER_LABEL
  quantity:     integer("quantity").notNull(),
  jobType:      text("job_type").notNull(),        // GENERAL | SHORT
  cutting:      text("cutting").notNull(),          // Y | N
  priority:     integer("priority").notNull(),
  status:       text("status").notNull(),           // ORDERED | RECEIVED | IN_PROGRESS | READY_TO_SHIP | DONE | CANCELLED
  dueDate:      text("due_date").notNull(),
  createdAt:    text("created_at").notNull(),
  completedAt:  text("completed_at"),             // 완료 처리 시각 (DONE 전환 시 기록)
});

// ─── 원자재 입고 ─────────────────────────────────────────
export const rawStockReceipts = sqliteTable("raw_stock_receipts", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  materialType: text("material_type").notNull(),   // CHIP | FABRIC | STICKER_PAPER
  quantity:     integer("quantity").notNull(),
  receivedDate: text("received_date").notNull(),   // YYYY-MM-DD
  note:         text("note"),
  createdAt:    text("created_at").notNull(),
});

// ─── 1차 공정 세션 ───────────────────────────────────────
export const firstProcessSessions = sqliteTable("first_process_sessions", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  orderId:         text("order_id").references(() => orders.id),
  processType:     text("process_type").notNull(),  // 컨버팅 | 스티커 컨버팅
  workDate:        text("work_date").notNull(),      // YYYY-MM-DD
  targetQty:       integer("target_qty").notNull(),
  outputQty:       integer("output_qty"),
  shortQty:        integer("short_qty").default(0),
  startedAt:       text("started_at"),
  endedAt:         text("ended_at"),
  status:          text("status").notNull().default("IN_PROGRESS"), // IN_PROGRESS | DONE | DEFECT_STOPPED
  parentSessionId: integer("parent_session_id"),    // 공정불량 재시작시 원본 세션 FK
  restartFromQty:  integer("restart_from_qty"),     // 어디서 중단됐는지
  note:            text("note"),
  createdAt:       text("created_at").notNull(),
});

// ─── 2차 공정 세션 ───────────────────────────────────────
export const secondProcessSessions = sqliteTable("second_process_sessions", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  orderId:         text("order_id").references(() => orders.id),
  machineId:       integer("machine_id").notNull(),
  processType:     text("process_type").notNull(),  // care_label | sticker_label
  unitsPerHour:    integer("units_per_hour").notNull(), // config 스냅샷
  workDate:        text("work_date").notNull(),      // YYYY-MM-DD
  targetQty:       integer("target_qty").notNull(),  // AI 배정 수량
  outputQty:       integer("output_qty"),            // 최종 실생산
  shortQty:        integer("short_qty").default(0),  // 불량 수량
  workMinutes:     integer("work_minutes"),          // ended - started (분)
  startedAt:       text("started_at"),
  endedAt:         text("ended_at"),
  status:          text("status").notNull().default("IN_PROGRESS"), // IN_PROGRESS | DONE | DEFECT_STOPPED
  parentSessionId: integer("parent_session_id"),    // 공정불량 재시작시 원본 세션 FK
  restartFromQty:  integer("restart_from_qty"),
  note:            text("note"),
  createdAt:       text("created_at").notNull(),
});

// ─── 이벤트 로그 ─────────────────────────────────────────
export const eventLogs = sqliteTable("event_logs", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  eventType:   text("event_type").notNull(),
  /*
    작업 시간 관련:
      WORK_START | WORK_DONE | PROCESS_DEFECT | SHORT_RECORD

    재고 흐름 관련:
      MATERIAL_RECEIPT        원자재 입고
      MATERIAL_TO_FIRST       원자재 → 1차 공정 투입
      FIRST_TO_SECOND         1차 공정 롤 → 2차 공정 투입 (현황판 차감)
      SECOND_PROCESS_DONE     2차 공정 완료
  */
  sessionType: text("session_type"),  // FIRST | SECOND (어느 공정 세션인지)
  sessionId:   integer("session_id"), // first_process_sessions or second_process_sessions FK
  orderId:     text("order_id"),
  machineId:   integer("machine_id"),
  qty:         integer("qty"),        // 수량 (쇼트, 입고, 투입 등)
  materialType: text("material_type"), // 재고 흐름 이벤트시 원자재 종류
  timestamp:   text("timestamp").notNull(),
  note:        text("note"),
});
