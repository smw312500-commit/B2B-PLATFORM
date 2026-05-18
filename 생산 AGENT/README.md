# MES Pro Dashboard

로컬에서 붙여주신 관리자 통합 대시보드를 바로 띄울 수 있도록 만든 React + Vite 프로젝트입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 표시된 로컬 주소를 열면 됩니다.

## Gemini API 연결

API 키가 없으면 앱은 자동으로 데모 모드로 동작합니다.

실제 API를 연결하려면 `.env` 파일을 만들고 아래 값을 넣으세요.

```bash
VITE_GEMINI_API_KEY=your_api_key
VITE_GEMINI_MODEL=gemini-2.5-flash-preview-09-2025
```

## 실행 환경 안내

이 프로젝트는 React/Vite 프론트엔드와 Node.js 기반 서버를 함께 사용하는 구조입니다.
로컬에서 직접 실행하려면 Node.js 설치가 필요합니다.

빠르게 결과물을 확인하실 수 있도록 PPT 자료에 주요 화면과 기능 흐름을 정리해두었습니다.
Node.js가 없는 환경에서는 PPT로 프로젝트를 검토하실 수 있고, 직접 실행을 원하시는 경우 아래 순서로 로컬에서 확인하실 수 있습니다.

```bash
npm install
cd server
npm install
cd ..
npm run build
npm run start
```
