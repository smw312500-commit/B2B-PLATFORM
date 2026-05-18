USE em_agent;

CREATE TABLE IF NOT EXISTS orders (
  id            VARCHAR(50)  PRIMARY KEY,
  order_number  VARCHAR(50)  NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  product_type  VARCHAR(50)  NOT NULL,
  quantity      INT          NOT NULL,
  job_type      VARCHAR(20)  NOT NULL,
  cutting       CHAR(1)      NOT NULL,
  priority      INT          NOT NULL,
  status        VARCHAR(30)  NOT NULL,
  due_date      DATE         NOT NULL,
  created_at    DATETIME     NOT NULL,
  completed_at  DATETIME     DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS raw_stock_receipts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  material_type VARCHAR(50)  NOT NULL,
  quantity      INT          NOT NULL,
  received_date DATE         NOT NULL,
  note          TEXT,
  created_at    DATETIME     NOT NULL
);

CREATE TABLE IF NOT EXISTS first_process_sessions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_id          VARCHAR(50),
  process_type      VARCHAR(50)  NOT NULL,
  work_date         DATE         NOT NULL,
  target_qty        INT          NOT NULL,
  output_qty        INT          DEFAULT NULL,
  short_qty         INT          DEFAULT 0,
  started_at        DATETIME     DEFAULT NULL,
  ended_at          DATETIME     DEFAULT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'IN_PROGRESS',
  parent_session_id INT          DEFAULT NULL,
  restart_from_qty  INT          DEFAULT NULL,
  note              TEXT,
  created_at        DATETIME     NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS second_process_sessions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_id          VARCHAR(50),
  machine_id        INT          NOT NULL,
  process_type      VARCHAR(50)  NOT NULL,
  units_per_hour    INT          NOT NULL,
  work_date         DATE         NOT NULL,
  target_qty        INT          NOT NULL,
  output_qty        INT          DEFAULT NULL,
  short_qty         INT          DEFAULT 0,
  work_minutes      INT          DEFAULT NULL,
  started_at        DATETIME     DEFAULT NULL,
  ended_at          DATETIME     DEFAULT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'IN_PROGRESS',
  parent_session_id INT          DEFAULT NULL,
  restart_from_qty  INT          DEFAULT NULL,
  note              TEXT,
  created_at        DATETIME     NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_type    VARCHAR(50)  NOT NULL,
  session_type  VARCHAR(10)  DEFAULT NULL,
  session_id    INT          DEFAULT NULL,
  order_id      VARCHAR(50)  DEFAULT NULL,
  machine_id    INT          DEFAULT NULL,
  qty           INT          DEFAULT NULL,
  material_type VARCHAR(50)  DEFAULT NULL,
  timestamp     DATETIME     NOT NULL,
  note          TEXT
);
