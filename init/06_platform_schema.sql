CREATE DATABASE IF NOT EXISTS platform_agent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE platform_agent;

-- 등록 기업
CREATE TABLE IF NOT EXISTS companies (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20)  NOT NULL,   -- PRODUCTION | LOGISTICS | PLATFORM
  db_name     VARCHAR(50),             -- 연결된 DB 이름
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  joined_at   DATETIME     NOT NULL
);

-- 플랫폼 통합 이벤트 로그 (양쪽에서 올라오는 이벤트 기록)
CREATE TABLE IF NOT EXISTS platform_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  company_id   INT,
  company_type VARCHAR(20),            -- PRODUCTION | LOGISTICS
  event_type   VARCHAR(50)  NOT NULL,
  payload      JSON,
  logged_at    DATETIME     NOT NULL
);
