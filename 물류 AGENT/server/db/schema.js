import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── 차량 ─────────────────────────────────────────────────────
export const vehicles = sqliteTable("vehicles", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  plateNumber: text("plate_number").notNull().unique(),
  vehicleType: text("vehicle_type").notNull(), // 1TON | 5TON | 11TON | 25TON
  capacityKg:  integer("capacity_kg").notNull(),
  status:      text("status").notNull().default("AVAILABLE"), // AVAILABLE | ON_DUTY | MAINTENANCE
  driverName:  text("driver_name").notNull(),
  driverPhone: text("driver_phone"),
  createdAt:   text("created_at").notNull(),
});

// ─── 배차 요청 (플랫폼이 작성, 물류가 처리) ───────────────────
export const dispatchRequests = sqliteTable("dispatch_requests", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  requestType:      text("request_type").notNull(), // PRODUCTION | IMPORT
  cargoDesc:        text("cargo_desc").notNull(),   // 화물 설명
  qty:              integer("qty"),                  // 수량
  weightKg:         real("weight_kg"),               // 무게(kg)
  pickupLocation:   text("pickup_location").notNull(),
  deliveryLocation: text("delivery_location").notNull(),
  requestedAt:      text("requested_at").notNull(),
  status:           text("status").notNull().default("PENDING"), // PENDING | ASSIGNED | COMPLETED | CANCELLED
});

// ─── 배차 ─────────────────────────────────────────────────────
export const dispatches = sqliteTable("dispatches", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  requestId:         integer("request_id").references(() => dispatchRequests.id),
  vehicleId:         integer("vehicle_id").references(() => vehicles.id),
  assignedAt:        text("assigned_at").notNull(),
  estimatedPickup:   text("estimated_pickup"),
  estimatedDelivery: text("estimated_delivery"),
  actualDeliveredAt: text("actual_delivered_at"),
  status:            text("status").notNull().default("ASSIGNED"), // ASSIGNED | IN_TRANSIT | DELIVERED | CANCELLED
  note:              text("note"),
  createdAt:         text("created_at").notNull(),
});

// ─── 이벤트 로그 ──────────────────────────────────────────────
export const eventLogs = sqliteTable("event_logs", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  eventType:  text("event_type").notNull(), // DISPATCH_ASSIGNED | STATUS_CHANGED | DELIVERED
  dispatchId: integer("dispatch_id"),
  vehicleId:  integer("vehicle_id"),
  requestId:  integer("request_id"),
  timestamp:  text("timestamp").notNull(),
  note:       text("note"),
});
