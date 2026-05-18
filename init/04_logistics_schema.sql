USE logistics_agent;

CREATE TABLE IF NOT EXISTS vehicles (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  plate_number VARCHAR(30)  NOT NULL UNIQUE,
  vehicle_type VARCHAR(10)  NOT NULL,
  capacity_kg  INT          NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
  driver_name  VARCHAR(50)  NOT NULL,
  driver_phone VARCHAR(20)  DEFAULT NULL,
  base_region  VARCHAR(50)  DEFAULT NULL,
  created_at   DATETIME     NOT NULL
);

CREATE TABLE IF NOT EXISTS dispatch_requests (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  request_type      VARCHAR(20)  NOT NULL,
  cargo_desc        VARCHAR(200) NOT NULL,
  qty               INT          DEFAULT NULL,
  weight_kg         DECIMAL(10,2) DEFAULT NULL,
  pickup_location   VARCHAR(200) NOT NULL,
  delivery_location VARCHAR(200) NOT NULL,
  requested_at      DATETIME     NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  em_order_id       VARCHAR(50)  DEFAULT NULL UNIQUE,
  em_receipt_id     INT          DEFAULT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dispatches (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  request_id          INT          DEFAULT NULL,
  vehicle_id          INT          DEFAULT NULL,
  assigned_at         DATETIME     NOT NULL,
  estimated_pickup    DATETIME     DEFAULT NULL,
  estimated_delivery  DATETIME     DEFAULT NULL,
  actual_delivered_at DATETIME     DEFAULT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'ASSIGNED',
  note                TEXT,
  created_at          DATETIME     NOT NULL,
  FOREIGN KEY (request_id) REFERENCES dispatch_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  event_type  VARCHAR(50)  NOT NULL,
  dispatch_id INT          DEFAULT NULL,
  vehicle_id  INT          DEFAULT NULL,
  request_id  INT          DEFAULT NULL,
  timestamp   DATETIME     NOT NULL,
  note        TEXT
);
