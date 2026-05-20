import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

// EM 생산기업 현황
router.get("/em", async (req, res) => {
  const [orders]   = await pool.execute("SELECT status, COUNT(*) as cnt, SUM(quantity) as total FROM em_agent.orders GROUP BY status");
  const [stocks]   = await pool.execute("SELECT material_type, SUM(quantity) as total FROM em_agent.raw_stock_receipts GROUP BY material_type");
  const [sessions] = await pool.execute("SELECT status, COUNT(*) as cnt FROM em_agent.second_process_sessions GROUP BY status");
  const [recent]   = await pool.execute("SELECT event_type, order_id, qty, material_type, timestamp, note FROM em_agent.event_logs ORDER BY timestamp DESC LIMIT 10");
  res.json({ orders, stocks, sessions, recentEvents: recent });
});

// 물류기업 현황
router.get("/logistics", async (req, res) => {
  const [vehicles]  = await pool.execute("SELECT status, COUNT(*) as cnt FROM logistics_agent.vehicles GROUP BY status");
  const [requests]  = await pool.execute("SELECT status, request_type, COUNT(*) as cnt FROM logistics_agent.dispatch_requests GROUP BY status, request_type");
  const [dispatches]= await pool.execute("SELECT status, COUNT(*) as cnt FROM logistics_agent.dispatches GROUP BY status");
  const [recent]    = await pool.execute("SELECT event_type, timestamp, note FROM logistics_agent.event_logs ORDER BY timestamp DESC LIMIT 10");
  res.json({ vehicles, requests, dispatches, recentEvents: recent });
});

// 등록 기업 목록
router.get("/companies", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM platform_agent.companies ORDER BY joined_at");
  res.json(rows);
});

// 플랫폼 통합 로그
router.get("/logs", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM platform_agent.platform_logs ORDER BY logged_at DESC LIMIT 50");
  res.json(rows);
});

// 귀로 최적화 매칭 알고리즘
// 배달 완료 후 복귀 중인 차량과 대기 중인 화물의 이동 경로를 공간 매칭
router.get("/backhaul-matching", async (req, res) => {
  // 최근 12시간 이내 배달 완료 + 현재 AVAILABLE 차량
  const [deliveredVehicles] = await pool.execute(`
    SELECT
      v.id            AS vehicleId,
      v.plate_number  AS plateNumber,
      v.vehicle_type  AS vehicleType,
      v.capacity_kg   AS capacityKg,
      v.driver_name   AS driverName,
      v.base_region   AS baseRegion,
      r.pickup_location   AS fromLocation,
      r.delivery_location AS currentLocation,
      d.actual_delivered_at AS deliveredAt
    FROM logistics_agent.dispatches d
    JOIN logistics_agent.vehicles v ON v.id = d.vehicle_id
    JOIN logistics_agent.dispatch_requests r ON r.id = d.request_id
    WHERE d.status = 'DELIVERED'
      AND v.status = 'AVAILABLE'
      AND d.actual_delivered_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
    ORDER BY d.actual_delivered_at DESC
  `);

  // PENDING 배차 요청 (귀로 후보)
  const [pendingRequests] = await pool.execute(`
    SELECT
      r.id              AS requestId,
      r.request_type    AS requestType,
      r.cargo_desc      AS cargoDesc,
      r.qty,
      r.weight_kg       AS weightKg,
      r.pickup_location   AS pickupLocation,
      r.delivery_location AS deliveryLocation,
      r.requested_at    AS requestedAt,
      r.note
    FROM logistics_agent.dispatch_requests r
    WHERE r.status = 'PENDING'
    ORDER BY r.requested_at
  `);

  // 매칭: 차량 현재 위치 ↔ 배차 요청 픽업 위치 공간 매칭
  const extractRegion = (str) => {
    if (!str) return "";
    // "서울 금천구 공장" → "서울", "부산항 3부두" → "부산"
    const m = str.match(/^(서울|부산|인천|경기|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/);
    return m ? m[1] : str.split(" ")[0];
  };

  const matched = [];
  const unmatched = [...pendingRequests];

  for (const vehicle of deliveredVehicles) {
    const vehicleRegion = extractRegion(vehicle.currentLocation);
    const matchIdx = unmatched.findIndex(r =>
      extractRegion(r.pickupLocation) === vehicleRegion &&
      (vehicle.capacityKg >= (r.weightKg ?? 0))
    );
    if (matchIdx !== -1) {
      const [request] = unmatched.splice(matchIdx, 1);
      matched.push({
        vehicle,
        request,
        matchReason: `차량 현위치(${vehicleRegion}) = 화물 픽업지(${extractRegion(request.pickupLocation)})`,
        returnRoute: `${vehicle.currentLocation} → ${request.deliveryLocation}`,
      });
    }
  }

  res.json({
    matched,
    unmatchedVehicles: deliveredVehicles.filter(v =>
      !matched.find(m => m.vehicle.vehicleId === v.vehicleId)
    ),
    unmatchedRequests: unmatched,
    summary: {
      totalDelivered: deliveredVehicles.length,
      totalPending:   pendingRequests.length,
      matchedCount:   matched.length,
    },
  });
});

export default router;
