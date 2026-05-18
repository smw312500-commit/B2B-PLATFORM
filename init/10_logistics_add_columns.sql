-- 기존 DB에 한 번만 실행하는 마이그레이션
-- Docker 재시작(fresh) 시에는 04_logistics_schema.sql 이 최신이므로 불필요

USE logistics_agent;

-- vehicles: 거점 지역 컬럼
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS base_region VARCHAR(50) DEFAULT NULL AFTER driver_phone;

-- dispatch_requests: 생산 수주 추적 (중복 방지용 UNIQUE)
ALTER TABLE dispatch_requests
  ADD COLUMN IF NOT EXISTS em_order_id VARCHAR(50) DEFAULT NULL AFTER status;

-- dispatch_requests: B/L 수입 입고 추적 (중복 방지용 UNIQUE)
ALTER TABLE dispatch_requests
  ADD COLUMN IF NOT EXISTS em_receipt_id INT DEFAULT NULL AFTER em_order_id;

-- 중복 방지 인덱스 (없을 때만)
CREATE UNIQUE INDEX IF NOT EXISTS ux_em_order_id   ON dispatch_requests(em_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_em_receipt_id ON dispatch_requests(em_receipt_id);
