# 근태관리 시스템 (T&A)

연구실 팀의 **출퇴근 · 연차 · 재택 · 반일 OFF · 주말/공휴일 근무**를 관리하는 웹 애플리케이션입니다.
핵심은 **접속 IP 기반 접근 제어**입니다. 연구실 IP에서는 언제든 접속할 수 있고, 그 밖의 장소(재택·휴일 근무)에서는 **신청서에 적은 날짜·시간대·IP에서만** 접속할 수 있습니다.

| 구분 | 폴더 | 스택 |
| --- | --- | --- |
| 프론트엔드 | [`frontend`](frontend) | Vue 3 · TypeScript · Vite |
| 백엔드 | [`backend`](backend) | NestJS 12 · TypeScript · 로컬 JSON 파일 저장소 |

데이터베이스 서버가 필요 없습니다. 클론 후 `npm install`만 하면 **로컬에서 바로 실행하고 테스트**할 수 있습니다.

## 목차

1. [주요 기능과 업무 규칙](#1-주요-기능과-업무-규칙)
2. [프로젝트 실행 방법](#2-프로젝트-실행-방법)
3. [기술 스택 및 선택 이유](#3-기술-스택-및-선택-이유)
4. [아키텍처 및 컨벤션](#4-아키텍처-및-컨벤션)
5. [데이터베이스 스키마 구조 및 설계 이유](#5-데이터베이스-스키마-구조-및-설계-이유)
6. [요구사항 구현 현황](#6-요구사항-구현-현황)
7. [개발 시 고민했던 점과 아쉬운 점](#7-개발-시-고민했던-점과-아쉬운-점)
8. [상세 문서](#8-상세-문서)

---

## 1. 주요 기능과 업무 규칙

**사용자 역할**

| 역할 | 할 수 있는 일 |
| --- | --- |
| 팀원 | 출근·퇴근 등록, 신청(연차·재택·반일 OFF·주말/공휴일 근무), 본인 현황·잔여·이력·정산 조회 |
| 리드 | 팀원 기능 + 팀 현황판, 팀 신청 조회와 승인·반려(본인 신청 제외), 공휴일·연구실 IP 관리, 팀 전체 이력·정산 |

**업무 규칙**

| 항목 | 규칙 |
| --- | --- |
| 출근 | 07:00부터 등록. 10:00:00을 **넘기면** 지각(정각은 정상) |
| 퇴근 | 16:00부터 등록 (반일 OFF 사용일은 제한 없음) |
| 근무시간 | 퇴근 − 출근 − 점심 1시간 (점심 11:30~12:30이 근무 구간에 **모두 포함될 때만** 제외) |
| 조퇴 | 근무시간 8시간 미만 (반일 OFF 사용일은 4시간 미만). 주말·공휴일 근무는 해당 없음 |
| 재택 | 월 2회, 이월 없음. 재택 때도 출퇴근 등록 |
| 연차 | 입사일 기준 매월 +1일 (입사일과 같은 날짜에 적립, 첫 적립은 입사 한 달 뒤) |
| 반일 OFF | 주말·공휴일 근무를 퇴근까지 마치면 1개 지급, 지급일로부터 30일 안에 사용 |
| 신청 기한 | 연차·재택·OFF·주말/공휴일 근무 모두 **대상일의 전 영업일 17:00**까지 |
| 접속 제한 | 연구실 IP는 상시 허용. 재택·주말/공휴일 근무는 신청한 날짜·시간대·IP에서만 허용 |
| 퇴근 미기록 | 다음 출근 때 퇴근 시각을 직접 입력해야 출근할 수 있고, '직접 입력'으로 표시 |

신청은 제출하는 즉시 효력이 있고(잔여 차감, 접속 허용), 리드가 반려하면 무효가 되어 잔여가 되돌아옵니다. 신청 취소는 신청 기한 전까지 가능합니다.

---

## 2. 프로젝트 실행 방법

### 2.1 요구 사항

- **Node.js 22.18 이상 또는 24.11 이상**(권장)과 npm. 일부 의존성(vue-router 5의 하위 패키지)이 이 버전을 요구합니다. 22.12~22.17에서도 동작하지만 `npm install` 때 엔진 경고가 출력됩니다. (Vite 8 자체의 최소 요구는 22.12 또는 20.19)
- 데이터베이스·Docker 등 **다른 설치는 필요 없습니다.**
- 개발·검증 환경: Node 22.15, npm 11, Windows 11 — 소스만 새 폴더에 복사해 `npm install`부터 아래 순서대로 실행·테스트해 확인했습니다.

### 2.2 설치와 실행

**빠른 준비** — 스크립트 하나(`scripts/setup.mjs`)가 GitHub에서 내려받기, `.env` 복사, 의존성 설치를 한 번에 합니다. 외부 패키지 없이 Node와 git만 쓰므로 Windows·macOS·Linux에서 같게 동작합니다.

```bash
# 아무것도 없는 상태에서: 스크립트 파일 하나만 받아 실행 (Windows PowerShell은 curl.exe)
curl -fsSLO https://raw.githubusercontent.com/lsh34206/TA/main/scripts/setup.mjs
node setup.mjs --clone --install     # git clone → TA 폴더 → .env 복사 → npm install

# 이미 git clone 했다면: 저장소 안에서
node scripts/setup.mjs --install     # 또는: npm run setup:install
```

| 명령 | 동작 |
| --- | --- |
| `node setup.mjs --clone` | `https://github.com/lsh34206/TA.git`을 현재 위치의 `TA` 폴더로 내려받고 `backend/.env.example`을 `backend/.env`로 복사합니다. |
| `--clone my-folder` | 내려받을 폴더 이름을 지정합니다. |
| `--clone --repo <주소>` | 다른 저장소(포크 등)에서 내려받습니다. |
| `--install` | `backend`·`frontend`에서 `npm install`까지 실행합니다. |
| `--force` | 이미 있는 `.env`도 예시 파일로 덮어씁니다. 기존 파일은 `.env.bak`으로 백업합니다. |
| (옵션 없음) | 이미 내려받은 저장소 안에서 `.env` 복사만 합니다. |

- **안전하게 다시 실행할 수 있습니다.** 이미 있는 `.env`는 건드리지 않고(`--force`가 없는 한), 이미 내려받은 폴더(`.git`이 있는 곳)는 clone을 건너뜁니다. 비어 있지 않은 폴더에는 내려받지 않고 멈춥니다.
- `.env`는 비밀 값이 들어가는 파일이라 `.gitignore`로 저장소에서 제외되어 있고, 저장소에는 예시 파일(`.env.example`)만 올라갑니다. 그래서 내려받은 직후에는 `.env`가 없고, 스크립트가 그 자리를 채워 줍니다.

아래 ①②는 같은 일을 손으로 하는 방법입니다. 스크립트를 썼다면 `npm install`과 `.env` 복사는 건너뛰고 실행 명령(`npm run start:dev`, `npm run dev`)만 입력하면 됩니다.

터미널 두 개를 엽니다.

**① 백엔드** — `http://localhost:3000/api`

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run start:dev
```

처음 실행하면 `backend/data/`가 만들어지고 초기 데이터(계정 3개, 연구실 IP `127.0.0.1`, 2026년 공휴일)가 들어갑니다. `.env.example`을 복사한 그대로 실행할 수 있습니다.

**② 프론트엔드** — `http://localhost:5173`

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:5173 으로 접속해 아래 계정으로 로그인합니다.

### 2.3 테스트 계정

| 아이디 | 이름 | 역할 | 입사일 |
| --- | --- | --- | --- |
| `geuntae` | 김근태 | 리드 | 2026-01-01 |
| `yeoncha` | 연차원 | 팀원 | 2026-01-15 |
| `jayul` | 임자율 | 팀원 | 2026-02-12 |

비밀번호는 세 계정 모두 **`backend/.env`의 `SEED_PASSWORD`** 값입니다. `.env.example`을 그대로 복사했다면 `change-me`입니다. (비밀번호는 `data/`가 처음 만들어질 때만 반영됩니다. 바꾸려면 `backend/data` 폴더를 지우고 다시 시작하세요.)

### 2.4 테스트

```bash
cd backend
npm test                    # 단위 테스트 37개 — 지각·근무시간·연차 적립·신청 기한 등 업무 규칙 경계값, 비밀 값 검사, 로그인 시도 제한
npm run test:e2e            # 전체 흐름 38개 — 로그인·IP 차단·출퇴근·신청·OFF·PDF·정산·이력·재시작 후 데이터 유지·이력 파일 복구·로그인 잠금
npm run lint                # oxlint

cd ../frontend
npm run build               # vue-tsc 타입 검사 + 번들
```

- e2e 테스트는 **임시 폴더**를 데이터 폴더로 쓰고 **시각을 고정한 가짜 시계**(`FakeClock`)로 실행합니다. 그래서 언제 실행해도 결과가 같고, 개발 중인 `backend/data`를 건드리지 않습니다.

### 2.5 직접 눌러 보며 확인하기

시간·IP 규칙은 **지금 시각과 접속 IP**를 기준으로 판정되므로 로컬에서는 다음을 알아 두세요.

- **출근은 07:00 이후, 퇴근은 16:00 이후**에만 등록됩니다(KST 기준). 그 전에는 "출근은 07:00부터 …" 안내와 함께 거절됩니다. 모든 시각 경계(10:00:01 지각, 점심 포함 여부, 휴일근무 등)는 e2e 테스트가 재현합니다.
- **IP 제한 확인하기.** 로컬 접속은 `127.0.0.1`이라 연구실 IP로 인정됩니다. 다른 IP에서 접속한 상황은 헤더로 흉내 낼 수 있습니다(개발 설정 `TRUST_PROXY=loopback`).

  ```bash
  # 등록되지 않은 IP → 403 IP_NOT_ALLOWED (비밀번호가 맞아도 차단됩니다)
  curl -i -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.9" \
    -d '{"loginId":"geuntae","password":"change-me"}'
  ```

  재택을 신청하면서 접속 IP에 `203.0.113.9`와 현재 시각이 포함된 시간대를 적으면, 신청한 날짜에 같은 헤더로 접속할 수 있게 됩니다.
- 리드로 로그인하면 **접속 IP**(연구실 IP 등록·삭제), **공휴일**, **팀 신청 승인·반려**를 쓸 수 있습니다.

### 2.6 설정(환경 변수)

`backend/.env` (예시: [`backend/.env.example`](backend/.env.example))

| 이름 | 설명 | 기본값 |
| --- | --- | --- |
| `PORT` | 백엔드 포트 | `3000` |
| `JWT_SECRET` | 로그인 토큰 서명 키. **필수**, 32자 이상의 임의 문자열 | — |
| `SEED_PASSWORD` | 초기 계정 비밀번호. 데이터 파일을 처음 만들 때만 사용 | — |
| `LAB_IPS` | 초기 연구실 IP(쉼표 구분). 데이터 파일을 처음 만들 때만 사용 | `127.0.0.1` |
| `TRUST_PROXY` | `X-Forwarded-For`를 신뢰할 프록시. 개발 서버(Vite 프록시)는 `loopback`, 프록시가 없으면 **비워 둠** | `loopback`(예시 파일) |
| `CORS_ORIGIN` | 프론트엔드를 다른 주소에서 직접 호출할 때 허용할 출처 | `http://localhost:5173` |
| `DATA_DIR` | 데이터 폴더 | `backend/data` |
| `NODE_ENV` | `production`이면 약한 비밀 값을 거부합니다. `JWT_SECRET`이 32자 미만이거나 예시 값(`change-me…`)이면, 처음 데이터를 만들 때 `SEED_PASSWORD`가 8자 미만이거나 예시 값이면 **서버가 시작하지 않습니다.** 개발에서는 경고만 출력해 `.env.example`을 그대로 복사해 쓸 수 있습니다. | (비움 = 개발) |

프론트엔드: `API_TARGET`(개발 서버가 `/api`를 넘길 백엔드 주소, 기본 `http://localhost:3000`), `VITE_API_BASE`(빌드된 화면이 호출할 API 주소, 기본 `/api`).

### 2.7 빌드해서 실행하기

```bash
cd backend && npm run build && NODE_ENV=production npm run start:prod     # dist/main.js (PowerShell: $env:NODE_ENV='production')
cd frontend && npm run build                          # dist/ — 정적 파일(프록시 뒤에서 서빙)
```

### 2.8 문제 해결

| 증상 | 해결 |
| --- | --- |
| 시작할 때 `JWT_SECRET`/`SEED_PASSWORD` 오류 | `backend/.env`를 만들었는지 확인(`cp .env.example .env`). `NODE_ENV=production`이면 예시 값이나 짧은 값은 거부되니 충분히 긴 값으로 바꾸세요. |
| 로그인할 때 "시도가 너무 많습니다"(429) | 같은 IP에서 같은 아이디로 10분 안에 5번 틀리면 10분간 잠깁니다. 기다리거나 백엔드를 재시작하면(횟수는 메모리에만 있음) 풀립니다. |
| `npm install` 뒤 "vulnerabilities" 경고 | 개발 도구(devDependencies)에 대한 경고입니다. 실행에 쓰는 의존성은 `npm audit --omit=dev` 기준 0건입니다. |
| "접속할 수 없습니다" 화면 | 접속 IP가 연구실 IP 목록에 없는 경우입니다. 화면에 표시된 IP를 리드가 **접속 IP** 화면에서 등록하거나 `data/db.json`의 `allowedIps`에 추가하세요. 같은 PC가 아닌 기기(예: `192.168.x.x`)로 접속하면 해당 IP를 등록해야 합니다. |
| 데이터를 처음 상태로 되돌리기 | 서버를 끄고 `backend/data` 폴더를 삭제한 뒤 다시 시작 |
| 포트가 이미 사용 중 | 백엔드는 `.env`의 `PORT`, 프론트엔드는 `npm run dev -- --port 5174` (백엔드 포트를 바꿨다면 `API_TARGET=http://localhost:<포트>`도 지정) |
| Windows에서 `npm run …`이 동작하지 않음 | 프로젝트 **경로에 `&`가 있으면** npm 스크립트가 실행되지 않습니다. `&`가 없는 경로에 두거나, `node node_modules/<패키지>/…`로 직접 실행하세요. |

---

## 3. 기술 스택 및 선택 이유

| 영역 | 기술 | 선택 이유 |
| --- | --- | --- |
| 프론트엔드 | **Vue 3** (`<script setup>`) + **TypeScript** | 요구 스택. 화면이 폼·표·모달 중심이라 단일 파일 컴포넌트가 단순하고, `vue-tsc`가 템플릿까지 타입 검사 |
| 번들러 | **Vite 8** | 빠른 개발 서버, `/api` 프록시 내장(접속자 IP 전달에 사용) |
| 라우팅·상태 | vue-router, `reactive` 객체 | 전역 상태가 "로그인 세션" 하나뿐이라 상태 관리 라이브러리(Pinia)는 과함 |
| 백엔드 | **NestJS 12** + TypeScript | 모듈·DI·가드·파이프가 있어, "IP 검사 → 로그인 → 역할 확인"을 **전역 가드 한 곳**에 두고 모든 API를 기본 보호하기 좋음 |
| 검증 | class-validator · class-transformer | DTO 클래스에 선언한 규칙으로 요청 형식 자동 검증(알 수 없는 필드 제거) |
| 인증 | JWT (`@nestjs/jwt`) | 서버에 세션 저장소가 필요 없어 파일 저장소와 잘 맞음. 12시간 유효 |
| 비밀번호 | `node:crypto` **scrypt** | 내장 KDF라 별도 설치·네이티브 빌드가 없음(Windows 개발 환경에서 안정적) |
| 저장소 | **로컬 JSON 파일**(직접 구현한 `DataStore`) | DB 서버 없이 클론 즉시 실행·테스트. 자세한 이유는 [5장](#5-데이터베이스-스키마-구조-및-설계-이유) |
| PDF | pdfkit + Pretendard(OFL) | 신청서를 서버에서 생성. 한글 폰트를 저장소에 포함해 환경과 무관하게 같은 결과 |
| 테스트 | **Vitest** + supertest | ESM·TypeScript를 설정 없이 실행, Nest 앱 전체를 띄워 HTTP로 검증 |
| 코드 품질 | oxlint · Prettier · TypeScript `strict` | 빠른 린트, 일관된 포맷, 엄격한 타입 |

---

## 4. 아키텍처 및 컨벤션

### 4.1 구성

```
브라우저(Vue SPA) ──fetch /api──▶ Vite 프록시(:5173) ──▶ NestJS(:3000) ──▶ DataStore(메모리) ──commit──▶ backend/data/*.json
                                  (접속자 IP를 X-Forwarded-For로 전달)
```

NestJS 안에서 요청은 이렇게 흐릅니다.

```
AccessGuard(전역) ─ ① JWT 확인  ② 접속 IP·시간대 확인  ③ 역할 확인
      ▼
ValidationPipe → Controller → Service ─┬─▶ rules/*.ts   업무 규칙(순수 함수)
                                       ├─▶ DataStore    조회·수정(메모리) → commit()(파일 저장)
                                       └─▶ ActivityLog  이력 기록
```

- **인프라**: 별도로 구축한 것은 없습니다(로컬 실행 전제, Docker·CI 없음). 배포한다면 리버스 프록시가 정적 파일(`frontend/dist`)과 `/api`(백엔드 1대)를 나눠 서빙하는 구성을 권장하며, 이 경우 `TRUST_PROXY` 설정이 필요합니다. → [docs/architecture.md](docs/architecture.md#10-배포-시-권장-구성-구축하지는-않음)

### 4.2 소스 구조

```
.
├─ README.md, docs/                 문서
├─ scripts/setup.mjs                내려받은 직후 준비 (.env 복사, npm install) — 루트 package.json 은 이 스크립트용
├─ backend/
│  ├─ src/
│  │  ├─ auth/          로그인·JWT·전역 가드·데코레이터
│  │  ├─ attendance/    출근·퇴근·퇴근 직접 입력·월별 조회
│  │  ├─ applications/  신청 제출·취소·승인·반려·PDF, 잔여 조회
│  │  ├─ dashboard/     내 카드 · 팀 현황판 · 미기록 건
│  │  ├─ settlement/    월별 정산
│  │  ├─ logs/          이력 조회(분류·사용자·기간 필터)
│  │  ├─ holidays/      공휴일 관리            allowed-ips/  연구실 IP 관리
│  │  ├─ core/          공유 서비스(접속 허용 판단·공휴일·잔여 계산·이력 기록)
│  │  ├─ rules/         업무 규칙 순수 함수 + 단위 테스트
│  │  ├─ store/         JSON 저장소·레코드 타입·초기 데이터
│  │  └─ common/        KST 날짜 계산·Clock·AppError·IP 추출
│  ├─ test/app.e2e-spec.ts   전체 흐름 테스트
│  └─ assets/fonts/          PDF용 한글 폰트
└─ frontend/src/
   ├─ views/        화면 7개   ├─ components/  모달·헤더   ├─ stores/  로그인 세션
   ├─ api/          fetch 래퍼·응답 타입   └─ utils/  날짜 표시·라벨·이력 문장
```

### 4.3 컨벤션

| 구분 | 규칙 |
| --- | --- |
| 계층 | Controller(라우팅·검증·조회 범위) → Service(검사 순서·저장·이력) → `rules/`(**순수 함수**: DB·시계에 의존하지 않음) → `store/`. 업무 규칙은 `rules/`에만 둡니다. |
| 파일 이름 | kebab-case + 역할 접미사: `*.controller.ts` `*.service.ts` `*.module.ts` `*.rules.ts` `*.mapper.ts`. Vue는 PascalCase, 페이지는 `*View.vue` |
| 모듈 | ESM(`"type": "module"`). 백엔드 import 경로에 `.js` 확장자(`nodenext`), 프론트엔드는 `import type` 사용 |
| 포맷·린트 | 백엔드: Prettier(작은따옴표, 후행 쉼표) · oxlint · TypeScript `strict`. 프론트엔드: `vue-tsc` 타입 검사 |
| 시간 | 모든 판정은 **KST**. 날짜는 `'YYYY-MM-DD'`, 시각은 ISO 문자열. 서버는 `new Date()` 대신 주입된 `Clock` 사용(테스트에서 시각 고정) |
| 오류 | `AppError(status, code, message)` → 응답 `{ statusCode, code, message }`. 프론트는 `code`로 분기하고 `message`(한국어)를 그대로 표시 |
| 접근 제어 | **기본 거부**: 모든 엔드포인트는 로그인과 IP 검사를 거치고, 예외는 `@Public()`, 역할 제한은 `@Roles('LEAD')`로 명시 |
| 비밀 값·로그인 | 운영(`NODE_ENV=production`)에서는 약한 `JWT_SECRET`·`SEED_PASSWORD`면 서버가 시작하지 않음. 로그인은 (IP, 아이디) 단위로 10분 5회까지만 틀릴 수 있음 |
| 저장 | 데이터를 바꾼 뒤에는 반드시 `await store.commit()`. 검사와 변경 사이에는 `await`를 두지 않음(동시 요청이 끼어드는 것을 방지) |
| 이력 | 접속·출퇴근·신청·설정 변경은 모두 `ActivityLogService.log()`. 기록 실패가 본 업무를 막지 않음 |
| 화면 | 서버가 판정한 값(`canCancel`, `canDecide`, `isLate` …)을 그대로 표시하고 규칙을 화면에서 다시 계산하지 않음. 스타일은 `style.css`의 CSS 변수(디자인 토큰) 사용. 확인 창은 `window.confirm` 대신 `ConfirmModal` |
| 주석·문구 | 한국어. 요구사항 ID(`FR-…`, `FN-…`)를 해당 함수 주석에 표기 |

---

## 5. 데이터베이스 스키마 구조 및 설계 이유

### 5.1 저장 방식

`backend/data/` 아래 JSON 파일 두 개에 저장합니다(이력 파일은 첫 기록이 생길 때 만들어집니다). 서버가 시작할 때 메모리로 읽고, 변경할 때마다 임시 파일에 쓴 뒤 이름을 바꿔 저장하므로 **저장 중 끊겨도 파일이 깨지지 않습니다.** 파일이 깨져 있으면 덮어쓰지 않고 시작을 멈춥니다.

| 파일 | 컬렉션 |
| --- | --- |
| `db.json` | `users` · `allowedIps` · `holidays` · `attendances` · `applications` · `offGrants` |
| `activity-log.jsonl` | `activityLogs` — JSON Lines(한 줄에 한 건). 새 이력은 파일 끝에 **덧붙이기만** 합니다. 예전 `activity-log.json`이 있으면 첫 시작 때 자동으로 옮기고 원본은 `activity-log.json.bak`으로 남깁니다. |

### 5.2 구조와 관계

```
users ─┬─< attendances   (하루 1건: 출퇴근 시각·IP, 근무 형태, 지각·조퇴, 근무시간)
       ├─< applications  (종류·대상일·상태, 재택/휴일근무는 IP·시간대, 처리자 decidedById)
       ├─< offGrants     (휴일근무 1회 = OFF 1개: 지급일·만료일, attendanceId, 사용한 신청 usedByApplicationId)
       └─< activityLogs  (행위자·동작·IP·상세, 별도 파일)
holidays, allowedIps      (참조 데이터: 영업일 판정 / 접속 허용 판정)
```

| 컬렉션 | 핵심 필드 |
| --- | --- |
| `users` | `loginId`, `passwordHash`(scrypt), `name`, `role`(`MEMBER`/`LEAD`), `hireDate` |
| `allowedIps` | `ip`, `label` |
| `holidays` | `date`, `name` |
| `attendances` | `userId`, `workDate`, `workType`(`OFFICE`/`REMOTE`/`WEEKEND_WORK`), `clockIn/Out`(+IP), `clockOutManual`, `isLate`, `isEarlyLeave`, `workMinutes` |
| `applications` | `userId`, `type`(`ANNUAL`/`REMOTE`/`OFF`/`WEEKEND_WORK`), `targetDate`, `ip`·`startTime`·`endTime`, `status`(`PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`), `decidedById`·`decisionNote` |
| `offGrants` | `userId`, `attendanceId`, `grantedDate`, `expiresDate`, `usedByApplicationId` |
| `activityLogs` | `userId`, `action`, `ip`, `detail`, `createdAt` |

모든 레코드에는 자동 증가 `id`가 있고, 다른 레코드는 이 id로 참조합니다. 날짜는 `'YYYY-MM-DD'`(KST), 시각은 ISO 8601 문자열입니다. 필드별 설명은 [docs/database.md](docs/database.md)에 있습니다.

### 5.3 설계 이유

| 결정 | 이유 |
| --- | --- |
| **DB 서버 없이 JSON 파일** | "로컬에서 바로 실행·테스트"가 요구였습니다. 처음에는 MySQL+Prisma로 구현했으나 DB 설치·계정·마이그레이션 단계가 이를 막아 전환했습니다. 팀 단위 규모(수십 명, 연 수천 건)에서 충분하고, 테스트는 임시 폴더만 바꿔 완전히 격리됩니다. 서비스가 `find/filter/insert/update/remove`로만 접근해서 나중에 DB로 옮기기 쉽습니다. |
| **잔여를 저장하지 않고 계산** | 연차·재택 잔여를 입사일과 유효한 신청에서 매번 계산합니다. 신청·취소·반려마다 숫자를 맞춰야 하는 이중 기록이 없어 불일치가 생길 수 없고, 월말 시점 기준 잔여도 같은 함수로 구합니다. |
| **OFF는 지급 1건 = 1행** | OFF마다 만료일(지급 후 30일)이 달라서 숫자 하나로 관리할 수 없습니다. 행으로 두면 만료가 빠른 것부터 소진하고, 취소·반려 시 `usedByApplicationId`를 비워 되돌리며, 어떤 휴일근무로 받았는지 추적할 수 있습니다. |
| **판정 결과를 기록에 저장** | `isLate`·`isEarlyLeave`·`workMinutes`는 계산할 수 있지만, 그날의 판정을 **확정된 기록으로 보존**해 정산이 단순해지고 이후 규칙이 바뀌어도 과거 기록이 달라지지 않습니다. |
| **날짜·시각을 문자열로** | 날짜를 `Date`로 두면 UTC/KST 경계에서 하루가 밀립니다. 문자열은 시간대 변환이 없고, 비교(`>=`)가 곧 시간 비교라 기간 조회가 단순합니다. |
| **이력은 별도 파일, JSON Lines** | 이력은 추가만 되고 가장 빨리 늘어납니다. 같은 파일에 두거나 JSON 배열로 두면 기록할 때마다 이력 전체를 다시 써야 합니다. 한 줄에 한 건으로 두면 **새 줄만 덧붙이면 되고**, 쓰다가 서버가 꺼져 마지막 줄만 잘려도 그 줄만 버리고 시작할 수 있습니다(중간 줄이 깨졌다면 데이터를 잃지 않도록 시작을 멈춤). 반대로 업무 데이터 여섯 컬렉션은 "신청 + OFF 연결"처럼 함께 바뀌므로 한 파일을 한 번에 교체합니다. |
| **제약은 서비스 코드로 보장** | 하루 출근 1회, 같은 날짜 유효 신청 1건, IP·공휴일 날짜 유일 등을 DB 제약 대신 서비스가 검사합니다. 검사와 변경 사이에 `await`가 없어 동시 요청이 끼어들 수 없습니다(단일 프로세스 전제). |

**한계**: 백엔드 프로세스를 **하나만** 실행해야 하고(여러 개가 같은 폴더를 쓰면 서로 덮어씀), 업무 데이터(`db.json`)는 변경마다 파일 전체를 다시 쓰며(이력은 덧붙이기), 마이그레이션 도구가 없습니다. 서버를 끈 상태에서만 파일을 직접 고치세요. → [docs/database.md](docs/database.md#5-한계와-주의)

---

## 6. 요구사항 구현 현황

| 요구사항 | 구현 위치 |
| --- | --- |
| 접속 IP 제한 — 연구실 IP 상시 허용, 재택·휴일근무는 신청한 IP·시간대만 (FN-SYS-01) | [access.guard.ts](backend/src/auth/access.guard.ts), [access.service.ts](backend/src/core/access.service.ts) |
| 로그인·역할(팀원/리드) (FN-SYS-02) | [auth/](backend/src/auth) |
| 출근·퇴근, 지각·조퇴 판정, 점심 제외 근무시간 (FN-ATT-01·02) | [attendance.service.ts](backend/src/attendance/attendance.service.ts), [attendance.rules.ts](backend/src/rules/attendance.rules.ts) |
| 퇴근 누락 시 직접 입력('직접 입력' 표시) (FR-ATT-03, FN-ATT-03) | `attendance.service.ts`, 화면 `ManualClockOutModal.vue` |
| 주말·공휴일 출퇴근과 반일 OFF 지급 (FR-ATT-04, FN-ATT-04) | `attendance.service.ts`, `offGrants` |
| 신청 제출 — 기한·날짜 종류·잔여 검사 (FN-REQ-01) | [application.service.ts](backend/src/applications/application.service.ts), [application.rules.ts](backend/src/rules/application.rules.ts) |
| 승인·반려(선택), 취소 (FN-REQ-02) | `application.service.ts` (`decide`, `cancel`) |
| 신청서 PDF (FN-REQ-03) | [application-pdf.service.ts](backend/src/applications/application-pdf.service.ts) |
| 연차·재택·OFF 잔여 (FN-BAL-01) | [balance.rules.ts](backend/src/rules/balance.rules.ts), [balance.service.ts](backend/src/core/balance.service.ts) |
| 대시보드: 팀 현황판·내 카드·미기록 건 (FN-DSH-01·02·03) | [dashboard.service.ts](backend/src/dashboard/dashboard.service.ts) |
| 이력 (FR-LOG) | [logs/](backend/src/logs), [activity-log.service.ts](backend/src/core/activity-log.service.ts) |
| 월별 정산 (FN-STL-01) | [settlement.service.ts](backend/src/settlement/settlement.service.ts) |
| (추가) 공휴일 관리, 연구실 IP 관리 | [holidays/](backend/src/holidays), [allowed-ips/](backend/src/allowed-ips) |

---

## 7. 개발 시 고민했던 점과 아쉬운 점

### 고민했던 점

- **접속 IP가 곧 권한**이라는 점이 가장 신경 쓰였습니다. `X-Forwarded-For`를 그대로 믿으면 헤더만 바꿔 연구실 IP로 위장할 수 있어서, 신뢰할 프록시를 `TRUST_PROXY`로 명시할 때만 해석합니다. 로그인에서는 존재하지 않는 아이디에도 같은 시간을 들여 아이디 존재 여부가 응답 시간으로 드러나지 않게 했습니다.
- **시각 경계 규칙을 어떻게 검증할지.** "10:00:00 정각은 정상, 10:00:01부터 지각", "점심이 구간에 완전히 포함될 때만 1시간 제외", "입사일이 31일이면 말일에 적립" 같은 규칙은 실제 시각에 기대면 테스트할 수 없습니다. 규칙을 순수 함수(`rules/`)로 분리하고 시계를 주입(`Clock`)해서, 서버 없이 경계값을 단위 테스트하고 e2e에서는 시각을 고정했습니다.
- **로그인 무차별 대입 방어를 어떻게 설계할지.** 아이디만으로 잠그면 남이 일부러 틀려서 특정 계정을 막을 수 있어서 **(IP, 아이디) 조합**으로 센 뒤(10분 5회 → 10분 잠금), 아이디를 바꿔 가며 시도하는 경우를 위해 IP 전체 한도(20회)를 따로 두었습니다. 로그인에 성공해도 IP 전체 횟수는 지우지 않아, 자기 계정으로 성공하면서 남의 계정을 추측하는 우회를 막습니다. 잠금 검사는 scrypt 검증 **앞**에서 해서 CPU도 아낍니다.
- **공휴일을 코드로 계산하지 않기로 한 것.** 설날·추석 연휴, 대체공휴일, 임시공휴일은 해마다 달라 라이브러리의 한국 데이터가 정확하지 않았습니다. 그래서 리드가 직접 등록하게 했고, **오늘 이전 날짜는 바꿀 수 없게** 막았습니다(이미 확정된 출퇴근·신청 판정이 소급해서 달라지는 것을 방지).
- **신청의 효력 시점.** 승인을 선택 사항으로 해석해서, 신청은 제출 즉시 효력이 있고(잔여 차감·접속 허용) 리드가 반려하면 무효가 되도록 했습니다. 이에 맞춰 "승인 대기" 상태도 유효한 신청으로 취급합니다.
- **DB를 없앤 뒤의 동시성.** JSON 저장소로 바꾸면서 "마지막 연차 1일을 동시에 두 번 신청" 같은 경쟁 상태가 걱정이었습니다. 조회·검사·변경을 `await` 없이 이어서 실행하면 Node에서는 중간에 끼어들 수 없다는 점을 이용했고, 저장만 순서가 보장되는 큐로 처리했습니다. 대신 **단일 프로세스**라는 전제가 생겼습니다.
- **내장 브라우저에서 확인 창이 거절되는 문제.** `window.confirm`이 뜨지 않고 곧바로 `false`를 돌려줘서 "신청 취소" 버튼이 아무 반응이 없는 것처럼 보였습니다. 화면 안의 `ConfirmModal`로 교체해 해결했습니다.
- **Windows 경로의 `&`.** 프로젝트 폴더 이름에 `&`가 있으면 `npm run`이 동작하지 않아, 개발 중에는 `node`로 직접 실행했습니다. 폴더 이름에 `&`를 쓰지 않는 것이 가장 좋습니다.

### 아쉬운 점

- **프론트엔드 자동화 테스트가 없습니다.** 타입 검사와 브라우저 수동 확인에 의존했습니다. Playwright 같은 도구로 로그인·출근·신청 흐름을 자동화하고 싶었습니다.
- **JSON 저장소의 한계.** 단일 프로세스, 업무 데이터는 변경마다 전체 파일 쓰기, 마이그레이션 도구 없음, 저장 실패 시 메모리 변경을 되돌리지 않음(다음 저장 때 반영). 사용자가 늘면 `DataStore`를 실제 DB로 교체해야 합니다(서비스가 `Table`의 `find/filter/insert/update/remove`로만 접근하도록 해 둔 것이 그 대비입니다).
- **보안 보강 여지.** 토큰을 `localStorage`에 저장하고(XSS에 취약), 리프레시 토큰이나 서버 측 로그아웃 무효화가 없으며, 비밀번호 변경 기능이 없습니다. 로그인 시도 제한은 있지만 횟수를 메모리에만 세므로 서버를 재시작하면 초기화되고 프로세스가 여럿이면 공유되지 않습니다. 로그인 실패 이력에는 입력한 아이디가 그대로 남아, 비밀번호를 아이디 칸에 잘못 넣으면 이력에 남을 수 있습니다(마스킹 필요).
- **사용자 관리 화면이 없습니다.** 계정은 초기 데이터 3개이고, 추가·수정은 `db.json`을 직접 고쳐야 합니다.
- **연구실 IP는 개별 주소만** 등록할 수 있고 대역(CIDR)은 지원하지 않습니다.
- **2026년 공휴일 초기 데이터는 공식 달력과 대조가 필요합니다**(추석 연휴의 대체공휴일, 제헌절 등 확신하지 못한 항목이 있습니다).
- **기능 범위.** 승인 알림(메일·메신저)이 없고, 정산은 화면 조회만 가능하며 CSV/엑셀 내보내기가 없습니다. 연차는 요구사항대로 "입사일 기준 매월 +1일"의 단순 적립이며 소멸·이월은 다루지 않습니다.
- **배포 자동화가 없습니다.** Docker·CI를 만들지 못했습니다.

---

## 8. 상세 문서

| 문서 | 내용 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 요청 흐름, 계층·모듈 구조, 접근 제어, 시간 처리, 프론트엔드 구조, 시나리오, 테스트 전략, 배포 구성 |
| [docs/database.md](docs/database.md) | 저장 방식, 관계도(ER), 컬렉션별 필드, 설계 이유, 한계 |
| [docs/api.md](docs/api.md) | API 목록, 권한, 오류 코드 |
