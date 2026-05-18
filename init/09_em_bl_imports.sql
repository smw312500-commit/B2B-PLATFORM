USE em_agent;

-- B/L 원본 정보 (생산기업 소유)
CREATE TABLE IF NOT EXISTS bl_imports (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  bl_number        VARCHAR(100) NOT NULL,
  vessel           VARCHAR(100),
  origin_port      VARCHAR(100),          -- 선적항 (Le Havre 등)
  destination_port VARCHAR(100),          -- 도착항 (부산, 광양 등)
  pickup_address   VARCHAR(200),          -- 픽업 장소 (부산항 3부두 등)
  delivery_address VARCHAR(200),          -- 배달 장소 (서울 금천구 공장 등)
  eta              DATE         NOT NULL,
  created_at       DATETIME     NOT NULL
);

-- raw_stock_receipts에 bl_id 컬럼 추가
ALTER TABLE raw_stock_receipts
  ADD COLUMN bl_id INT DEFAULT NULL,
  ADD CONSTRAINT fk_raw_stock_bl FOREIGN KEY (bl_id) REFERENCES bl_imports(id) ON DELETE SET NULL;
