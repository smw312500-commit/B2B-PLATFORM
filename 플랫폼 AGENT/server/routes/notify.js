import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const PRODUCT_LABEL = { CARE_LABEL: "케어라벨", STICKER_LABEL: "스티커라벨" };

// 생산기업 → 플랫폼: 출고 준비 완료 알림
router.post("/ready", async (req, res) => {
  const { companyName, orderId, orderNumber, productType, quantity, customerName, pickupAddress, deliveryAddress } = req.body;
  if (!companyName || !orderId || !orderNumber) {
    return res.status(400).json({ error: "companyName, orderId, orderNumber 필수" });
  }

  const ts = now();
  const cargoDesc = `${PRODUCT_LABEL[productType] ?? productType} 출고 (${orderNumber}) — ${companyName}`;
  const delivery  = deliveryAddress ?? `${customerName ?? "고객"} 납품처`;

  // 1. production_completions 기록 (중복 무시)
  const [ins] = await pool.execute(
    `INSERT IGNORE INTO platform_agent.production_completions
       (company_name, order_id, order_number, product_type, quantity, customer_name,
        pickup_address, delivery_address, status, notified_at)
     VALUES (?,?,?,?,?,?,?,?,'PENDING',?)`,
    [companyName, orderId, orderNumber, productType, quantity, customerName ?? null,
     pickupAddress ?? null, delivery, ts]
  );

  if (ins.affectedRows === 0) {
    return res.json({ ok: true, skipped: true, message: "이미 등록된 수주" });
  }

  // 2. 물류 배차 요청 생성 (플랫폼이 대행)
  await pool.execute(
    `INSERT IGNORE INTO logistics_agent.dispatch_requests
       (request_type, cargo_desc, qty, pickup_location, delivery_location, status, requested_at, em_order_id)
     VALUES ('PRODUCTION',?,?,?,?,'PENDING',?,?)`,
    [cargoDesc, quantity, pickupAddress ?? "공장", delivery, ts, orderId]
  );

  // 3. 플랫폼 로그
  await pool.execute(
    `INSERT INTO platform_agent.platform_logs (company_type, event_type, message, logged_at)
     VALUES ('PRODUCTION','READY_TO_SHIP',?,?)`,
    [`[${companyName}] ${orderNumber} 출고 준비 — ${Number(quantity).toLocaleString()}개`, ts]
  );

  // 4. 귀로 기회 감지: 최근 6시간 이내 공장 근처에 배달 완료된 가용 차량
  const region = (pickupAddress ?? "").split(" ").slice(0, 2).join(" ");
  const [nearbyVehicles] = await pool.execute(
    `SELECT v.id, v.plate_number AS plateNumber, v.driver_name AS driverName,
            v.base_region AS baseRegion, r.delivery_location AS lastLocation
     FROM logistics_agent.dispatches d
     JOIN logistics_agent.vehicles v ON v.id = d.vehicle_id
     JOIN logistics_agent.dispatch_requests r ON r.id = d.request_id
     WHERE d.status = 'DELIVERED'
       AND v.status = 'AVAILABLE'
       AND d.actual_delivered_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
       AND r.delivery_location LIKE ?`,
    [`%${region}%`]
  );

  if (nearbyVehicles.length > 0) {
    await pool.execute(
      `INSERT INTO platform_agent.platform_logs (company_type, event_type, message, logged_at)
       VALUES ('PLATFORM','RETURN_TRIP_OPPORTUNITY',?,?)`,
      [`귀로 기회: ${nearbyVehicles[0].plateNumber} (${nearbyVehicles[0].lastLocation}) → ${delivery}`, ts]
    );
  }

  res.status(201).json({
    ok: true,
    returnTripOpportunity: nearbyVehicles.length > 0 ? nearbyVehicles[0] : null,
  });
});

// 플랫폼 대시보드: 생산 완료 목록 조회
router.get("/completions", async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT * FROM platform_agent.production_completions
     ORDER BY notified_at DESC LIMIT 50`
  );
  res.json(rows);
});

// 귀로 플랜: 인바운드(수입 배송 중) + 아웃바운드(출고 대기) 연결 뷰
router.get("/return-plan", async (req, res) => {
  // 수입 배송 중인 차량 (부산→서울 방향)
  const [inbound] = await pool.execute(
    `SELECT d.id AS dispatchId, d.status AS dispatchStatus,
            r.id AS requestId, r.cargo_desc AS cargoDesc,
            r.pickup_location AS pickupLocation, r.delivery_location AS deliveryLocation,
            r.qty, r.weight_kg AS weightKg,
            v.plate_number AS plateNumber, v.driver_name AS driverName,
            v.vehicle_type AS vehicleType, v.base_region AS baseRegion,
            d.estimated_pickup AS estimatedPickup, d.estimated_delivery AS estimatedDelivery
     FROM logistics_agent.dispatches d
     JOIN logistics_agent.dispatch_requests r ON r.id = d.request_id
     JOIN logistics_agent.vehicles v ON v.id = d.vehicle_id
     WHERE r.request_type = 'IMPORT'
       AND d.status IN ('ASSIGNED','IN_TRANSIT')
     ORDER BY d.assigned_at DESC
     LIMIT 10`
  );

  // 출고 대기 중인 생산 요청 (귀로 후보)
  const [outbound] = await pool.execute(
    `SELECT r.id AS requestId, r.cargo_desc AS cargoDesc,
            r.pickup_location AS pickupLocation, r.delivery_location AS deliveryLocation,
            r.qty, r.requested_at AS requestedAt, r.note, r.em_order_id AS emOrderId,
            c.customer_name AS customerName, c.product_type AS productType
     FROM logistics_agent.dispatch_requests r
     LEFT JOIN platform_agent.production_completions c ON c.order_id = r.em_order_id
     WHERE r.request_type = 'PRODUCTION' AND r.status = 'PENDING'
     ORDER BY r.requested_at DESC`
  );

  res.json({ inbound, outbound });
});

export default router;
