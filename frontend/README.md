# frontend

Vue 3 + TypeScript + Vite 화면입니다. 실행 방법, 아키텍처, 데이터 구조는 저장소 루트의 [README.md](../README.md)와 [docs/](../docs)를 보세요.

```bash
npm install
npm run dev              # http://localhost:5173  (/api 는 http://localhost:3000 으로 프록시)
npm run build            # vue-tsc 타입 검사 + 번들
```

백엔드 주소가 다르면 `API_TARGET=http://localhost:4000 npm run dev` 처럼 지정합니다.
