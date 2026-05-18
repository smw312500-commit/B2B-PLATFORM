USE logistics_agent;

-- 차량 5대
INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, status, driver_name, driver_phone, created_at) VALUES
('서울 12가 3456', '5TON',  5000,  'AVAILABLE',   '김민준', '010-1234-5678', NOW()),
('경기 34나 7890', '11TON', 11000, 'AVAILABLE',   '이수현', '010-2345-6789', NOW()),
('인천 56다 1234', '25TON', 25000, 'ON_DUTY',     '박정호', '010-3456-7890', NOW()),
('부산 78라 5678', '5TON',  5000,  'AVAILABLE',   '최서연', '010-4567-8901', NOW()),
('대구 90마 9012', '1TON',  1000,  'MAINTENANCE', '정태양', '010-5678-9012', NOW());

-- 배차 요청 4건
INSERT INTO dispatch_requests (request_type, cargo_desc, qty, weight_kg, pickup_location, delivery_location, requested_at, status) VALUES
('IMPORT',     '나일론 태피터 원단',  200,    24000, '부산항 3부두',     '서울 금천구 공장',              '2026-05-21 09:00:00', 'PENDING'),
('IMPORT',     '라벨 스티커지',       30,     12600, '부산항 3부두',     '서울 금천구 공장',              '2026-05-21 09:05:00', 'PENDING'),
('IMPORT',     'RFID 칩',            500000, 3200,  '부산항 3부두',     '서울 금천구 공장',              '2026-05-21 09:10:00', 'PENDING'),
('PRODUCTION', '케어라벨 출고',       45000,  180,   '서울 금천구 공장', '서울 성동구 이스트우드 물류센터', '2026-05-14 14:00:00', 'ASSIGNED');

-- 배차 1건 (4번째 요청 — 케어라벨 출고)
INSERT INTO dispatches (request_id, vehicle_id, assigned_at, estimated_pickup, estimated_delivery, status, note, created_at)
VALUES (4, 1, '2026-05-14 14:05:00', '2026-05-14 15:00:00', '2026-05-14 18:00:00', 'ASSIGNED', 'AI 자동 배차', '2026-05-14 14:05:00');

UPDATE vehicles SET status = 'ON_DUTY' WHERE id = 1;

-- 이벤트 로그
INSERT INTO event_logs (event_type, dispatch_id, vehicle_id, request_id, timestamp, note)
VALUES ('DISPATCH_ASSIGNED', 1, 1, 4, '2026-05-14 14:05:00', 'AI 자동 배차 — 5톤 김민준 기사');
