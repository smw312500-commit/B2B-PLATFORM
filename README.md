# B2B AI Agent Platform

AI Agent를 납품하는 플랫폼 기업의 관점에서, 제조기업(EM)과 물류기업을 연결하는 B2B 통합 시스템입니다.

## 시스템 구조

```
플랫폼 기업 (AgentCompany)
├── 제조기업 AI Agent (EM)   — 수주·생산·재고·B/L 관리
└── 물류기업 AI Agent        — 배차·차량·운송 관리

핵심 흐름:
B/L 업로드 → 물류 배차 대기 자동 생성
생산 완료(READY_TO_SHIP) → 물류 출고 배차 자동 생성
부산→서울 납품 완료 → 플랫폼 Agent 귀로 화물 자동 매칭
```

| 서비스 | 백엔드 포트 | 프론트 포트 | 역할 |
|--------|------------|------------|------|
| 플랫폼 AGENT | 3000 | 5175 | 통합 모니터링 + AI Agent 루프 |
| 생산 AGENT | 3001 | 5173 | 수주·생산·재고·B/L 관리 |
| 물류 AGENT | 3002 | 5174 | 배차·차량·운송 관리 |
| MySQL | 3306 | - | 중앙 데이터 저장소 |

## 데이터베이스 구조

```
MySQL 8.0
├── platform_agent   ← 플랫폼 (등록 기업, Agent 로그)
├── em_agent         ← 제조기업 (수주, 생산, 재고, B/L)
└── logistics_agent  ← 물류기업 (차량, 배차, 운송)
```

## 시작하기

### 1. 환경변수 설정

각 서버의 `.env.example`을 복사해 `.env`로 만듭니다.

```bash
cp "생산 AGENT/server/.env.example" "생산 AGENT/server/.env"
cp "물류 AGENT/server/.env.example" "물류 AGENT/server/.env"
cp "플랫폼 AGENT/server/.env.example" "플랫폼 AGENT/server/.env"
```

각 `.env`에 OpenAI API 키를 입력합니다. MySQL 접속 정보는 기본값 그대로 사용 가능합니다.

### 2. MySQL 실행 (Docker)

```bash
docker compose up -d
```

`init/` 폴더의 SQL 파일이 **자동으로 순서대로 실행**됩니다. DB 생성, 테이블, 시드 데이터까지 한 번에 구성됩니다.

> Docker가 없으면 [MySQL 8.0](https://dev.mysql.com/downloads/mysql/) 설치 후 `.env`의 `MYSQL_PASSWORD`를 본인 비밀번호로 변경하고 `init/` SQL 파일을 순서대로 직접 실행하세요.

### 3. 패키지 설치 및 서버 실행

```bash
npm install
npm start
```

3개 서버가 동시에 실행됩니다.

| 서비스 | 주소 |
|--------|------|
| 생산 AGENT | http://localhost:5173 |
| 물류 AGENT | http://localhost:5174 |
| 플랫폼 AGENT | http://localhost:5175 |

## DB 초기화 파일 설명

| 파일 | 내용 |
|------|------|
| 01_create_databases.sql | 3개 DB 생성 |
| 02_em_schema.sql | 제조기업 테이블 |
| 03_em_seed.sql | 수주 20건 / 700,000장 샘플 |
| 04_logistics_schema.sql | 물류기업 테이블 |
| 05_logistics_seed.sql | 차량 10대 / 거점지역 샘플 |
| 06_platform_schema.sql | 플랫폼 테이블 |
| 07_platform_seed.sql | 등록 기업 2개 |
| 08_em_material_specs.sql | 소재별 무게 기준 |
| 09_em_bl_imports.sql | B/L 입고 테이블 |

## 주요 기능

**생산 AGENT**
- 수주 관리 및 생산 공정 추적
- B/L PDF 업로드 → OpenAI로 자동 파싱 → 입고 일정 등록
- 입고 등록 시 물류 배차 요청 자동 생성
- 재고 AI 조언 (입고 예정 + 1차 공정 완료 재고 반영)
- 수주 상태별 조회 (진행중 / 완료 / 전체)

**물류 AGENT**
- AI 자동 배차 (Gemini 기반 차량 선택)
- 차량 관리 (10대 / 거점지역별 분류)
- 배차 현황 및 상태 관리

**플랫폼 AGENT**
- 생산·물류 양사 실시간 모니터링
- 기업 간 데이터 자동 연동 (B/L → 배차, 출고 → 배차)

## 기술 스택

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express (ESM)
- **Database**: MySQL 8.0
- **AI**: OpenAI GPT-4o-mini / Google Gemini 2.5 Flash
- **동시 실행**: concurrently
