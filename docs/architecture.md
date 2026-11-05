# 아키텍처

[← README로 돌아가기](../README.md)

## 1. 전체 구성

```
┌─────────────────────────── 브라우저 ───────────────────────────┐
│  Vue 3 SPA (frontend/)                                        │
│  views ─ components ─ stores/session ─ api/client             │
└──────────────┬────────────────────────────────────────────────┘
               │  fetch('/api/...')  Authorization: Bearer <JWT>
               ▼
        Vite 개발 서버 :5173  ── /api 요청을 :3000 으로 프록시 (접속자 IP를 X-Forwarded-For로 전달)
               ▼
┌─────────────────────── NestJS (backend/) :3000 ───────────────────────┐
│  AccessGuard(전역) → ValidationPipe → Controller → Service            │
│                                              │          │            │
│                                        rules/*.ts   DataStore        │
│                                       (순수 함수)  (메모리 Table)      │
└─────────────────────────────────────────────────┬─────────────────────┘
                                                  ▼ commit()
                                  backend/data/db.json, activity-log.jsonl
```

- 데이터베이스 서버는 없습니다. 서버가 시작할 때 JSON 파일을 메모리로 읽고, 변경할 때마다 파일에 저장합니다. 자세한 내용은 [database.md](database.md)를 보세요.
- 프론트엔드와 백엔드는 **REST + JSON**으로만 통신합니다. 명세는 [api.md](api.md)에 있습니다.

## 2. 요청 한 건이 지나가는 길

```
요청 ─▶ ① AccessGuard
          ├ JWT 검증 → 사용자 조회                     실패: 401 UNAUTHORIZED
          ├ 접속 IP·시간대 허용? (FN-SYS-01)           실패: 403 IP_NOT_ALLOWED  (+ 이력 ACCESS_DENIED)
          └ @Roles('LEAD') 인가?                       실패: 403 FORBIDDEN
      ─▶ ② ValidationPipe (DTO 형식 검사, 알 수 없는 필드 제거)   실패: 400
      ─▶ ③ Controller   라우팅·파라미터 추출·역할별 접근 범위 결정
      ─▶ ④ Service      검사 순서, 업무 규칙 호출, 저장(commit), 이력 기록
      ─▶ ⑤ 응답 (오류는 AppError → { statusCode, code, message, ...extra })
```

`@Public()`을 붙인 엔드포인트(로그인, 헬스체크)를 제외한 **모든 API가 기본적으로 로그인과 IP 검사를 거칩니다.** 새 엔드포인트를 추가하면 자동으로 보호됩니다(기본 거부).

## 3. 백엔드 구조

```
backend/src
├─ main.ts, app.setup.ts, app.module.ts    부트스트랩 · 전역 설정(prefix /api, ValidationPipe, CORS, trust proxy)
├─ auth/          로그인·JWT·전역 가드·데코레이터(@Public @Roles @CurrentUser @ClientIp)·scrypt
├─ attendance/    출근·퇴근·퇴근 직접 입력·월별 조회
├─ applications/  신청(연차·재택·반일 OFF·휴일근무) 제출·취소·승인·반려·PDF, 잔여 조회
├─ dashboard/     내 카드, 팀 현황판(리드), 미기록 건
├─ settlement/    월별 정산
├─ logs/          이력 조회(분류·사용자·기간 필터)
├─ holidays/      공휴일 관리(리드)
├─ allowed-ips/   연구실 IP 관리(리드)
├─ core/          여러 기능이 공유하는 서비스(전역 모듈): 접속 허용 판단, 공휴일, 잔여 계산, 이력 기록, 로그인 시도 제한
├─ rules/         업무 규칙 순수 함수 + 단위 테스트
├─ store/         JSON 저장소(DataStore, Table), 레코드 타입, 최초 데이터
└─ common/        KST 날짜 계산, Clock, AppError, 접속 IP 추출
```

### 계층 책임

| 계층 | 하는 일 | 하지 않는 일 |
| --- | --- | --- |
| Controller | 라우트, DTO 선언, 서비스 호출(모든 컨트롤러가 이 범위만 담당) | 업무 규칙, 저장소 접근 |
| Service | 검사 순서, 저장, 이력, 응답 변환 (`holiday-admin`·`allowed-ips`·`logs` 서비스 포함) | 시각·날짜 계산 자체 |
| `rules/*.ts` | 지각·근무시간·연차 적립·신청 기한 같은 **순수 계산** | DB·시계·Nest 의존 |
| `store/` | 메모리 Table, 파일 저장 | 업무 판단 |

규칙을 순수 함수로 분리해서, 시각이 중요한 규칙(10:00:00 정각, 점심 포함 여부, 월말 연차 적립 등)을 서버 없이 `rules.spec.ts`로 빠르게 검증합니다.

### 모듈 의존

`StoreModule`(DataStore)과 `CoreModule`(Clock, ActivityLogService, HolidayService, AccessService, BalanceService)은 **전역 모듈**입니다. 기능 모듈은 서로를 import하지 않고 이 두 모듈만 주입받으므로 순환 의존이 생기지 않습니다.

```
AttendanceModule ┐
ApplicationsModule ├─▶ CoreModule(전역) ─▶ StoreModule(전역)
DashboardModule  ├     AuthModule: 전역 가드(APP_GUARD)와 JwtModule 보유
SettlementModule ┘
```

## 4. 접근 제어

접속 IP가 곧 접근 권한이라 이 프로젝트에서 가장 중요한 규칙입니다.

| 상황 | 허용 여부 |
| --- | --- |
| 연구실 IP(`allowedIps`)에서 접속 | 항상 허용 |
| 그 외 IP | 오늘 날짜의 **재택·주말/공휴일 근무 신청**에 적은 IP이고 **시간대 안**일 때만 허용 |
| 위 두 경우가 아님 | 로그인·모든 API 거부(403), 이력에 `ACCESS_DENIED` |

- 판단은 [access.service.ts](../backend/src/core/access.service.ts)(`isAllowed`)가 하고, 가드(`access.guard.ts`)와 로그인(`auth.service.ts`)이 같은 함수를 씁니다.
- 접속자 IP는 `req.ip`를 정규화(`::ffff:1.2.3.4` → `1.2.3.4`, `::1` → `127.0.0.1`)해서 씁니다. `X-Forwarded-For`는 `TRUST_PROXY`로 신뢰를 지정한 프록시 뒤에서만 해석됩니다. 프록시 없이 직접 노출할 때 `TRUST_PROXY`를 비워 두지 않으면 헤더 조작으로 IP 제한을 우회할 수 있습니다.
- 로그인에서는 존재하지 않는 아이디에도 더미 해시로 같은 시간을 들여 아이디 존재 여부가 응답 시간으로 드러나지 않게 했습니다.

### 로그인 시도 제한 ([login-throttle.service.ts](../backend/src/core/login-throttle.service.ts))

| 한도 | 기준 | 초과하면 |
| --- | --- | --- |
| 10분 안에 5번 실패 | (접속 IP, 아이디) 조합 | 10분간 잠금 → `429 TOO_MANY_ATTEMPTS` (`retryAfterSeconds` 포함) |
| 10분 안에 20번 실패 | 접속 IP 전체 | 같은 IP의 모든 로그인 10분간 잠금 |

- 아이디만으로 잠그면 남이 일부러 틀려서 특정 계정을 막을 수 있으므로 **IP와 함께** 셉니다. 아이디는 대소문자·공백을 무시하고 같은 계정으로 봅니다.
- 잠금 검사는 비밀번호 검증(scrypt) **앞**에서 합니다. 잠긴 동안은 올바른 비밀번호로도 거절하고, 계산 비용도 쓰지 않습니다.
- 로그인에 성공하면 (IP, 아이디) 횟수만 지웁니다. IP 전체 횟수를 지우면 자기 계정으로 성공하면서 남의 계정을 계속 추측할 수 있습니다.
- 잠금이 걸리는 순간 이력에 `LOGIN_LOCKED`를 **한 번만** 남깁니다(잠긴 뒤의 시도마다 남기면 이력이 넘칩니다).
- 횟수는 **메모리**에만 있어 서버를 재시작하면 초기화되고, 프로세스가 여럿이면 공유되지 않습니다.

### 운영 환경의 비밀 값 검사

`NODE_ENV=production`으로 실행하면 `JWT_SECRET`이 32자 미만이거나 `change-me…` 같은 예시 값일 때, 처음 데이터를 만들 때 `SEED_PASSWORD`가 8자 미만이거나 예시 값일 때 서버가 시작하지 않습니다([secret-check.ts](../backend/src/common/secret-check.ts)). 개발·테스트에서는 경고만 출력합니다.

## 5. 시간 처리

- 모든 업무 판정은 **한국 표준시(KST, UTC+9)** 기준입니다.
- 날짜는 `'YYYY-MM-DD'` 문자열, 시각은 ISO 8601 문자열(UTC)로 저장합니다. 둘 다 문자열 비교가 곧 시간 비교입니다.
- 서버는 `new Date()`를 직접 쓰지 않고 주입된 `Clock`을 씁니다. e2e 테스트는 `FakeClock`으로 "10:00:01 출근", "전 영업일 17:00 직전" 같은 경계를 정확히 재현합니다.

## 6. 이력(Activity Log)

접속·출퇴근·신청·설정 변경은 모두 `ActivityLogService.log()`로 기록합니다. 기록 실패가 본 업무를 막지 않도록 오류를 삼키고 서버 로그에만 남깁니다. 이력은 `activity-log.jsonl`(한 줄에 한 건)에 **새 줄만 덧붙여** 저장합니다. 이력 화면의 분류는 [log-category.ts](../backend/src/core/log-category.ts)의 `동작 → 분류` 표를 따르며, 동작을 추가하면 분류를 정하지 않을 경우 컴파일 오류가 납니다.

## 7. 프론트엔드 구조

```
frontend/src
├─ main.ts, App.vue     앱 시작, 공통 레이아웃(헤더 + 화면 자리), 접속 차단 안내 화면
├─ router.ts            주소별 화면, 로그인·리드 전용 검사
├─ stores/
│   ├─ session.ts       로그인 상태(토큰·사용자·접속 IP·차단 정보)를 담은 reactive 객체
│   └─ auth.ts          login / restore / logout
├─ api/
│   ├─ client.ts        fetch 래퍼: 토큰 헤더, ApiError 변환, 401·IP 차단 처리, PDF 다운로드
│   └─ types.ts         서버 응답 타입
├─ views/               화면 7개(Login, Dashboard, Applications, Settlement, Logs, Holidays, AllowedIps)
├─ components/          AppHeader, AppModal, ConfirmModal, ManualClockOutModal
├─ utils/               format(KST 표시), labels(라벨 사전), logs(이력 문장 생성)
└─ style.css            디자인 토큰(CSS 변수)과 공통 컴포넌트 스타일
```

- **상태 관리**: 전역 상태는 로그인 세션 하나뿐이라 Pinia 없이 `reactive` 객체로 충분합니다. 화면별 데이터는 각 화면이 직접 불러옵니다.
- **인증 흐름**: 토큰은 `localStorage`에 저장하고, 새로고침하면 `restore()`가 `/auth/me`로 복원합니다. 401이면 `client.ts`가 세션을 비우고 `App.vue`가 로그인 화면으로 보냅니다. IP 차단(403 `IP_NOT_ALLOWED`)은 로그인 상태는 유지한 채 "접속할 수 없습니다" 화면을 보여줍니다.
- **확인 창**: 브라우저 기본 `window.confirm`은 내장 브라우저에서 뜨지 않고 바로 거절되는 경우가 있어, 화면 안의 `ConfirmModal`을 씁니다.
- **서버 규칙을 화면이 다시 계산하지 않습니다.** 예를 들어 취소 가능 여부는 서버가 `canCancel`로 내려주고 화면은 그대로 표시합니다.

## 8. 대표 시나리오

**출근**

`DashboardView` → `POST /attendance/clock-in` → 가드(JWT·IP) → `AttendanceService.clockIn`

1. 지난 날 퇴근이 비어 있으면 409 `MISSING_CLOCK_OUT` (퇴근 직접 입력 모달로 유도)
2. 07:00 이전이면 400 `TOO_EARLY`
3. 오늘 이미 출근했으면 409
4. 주말·공휴일이면 신청한 날짜·시간대·IP와 일치해야 하고, 아니면 403 `WEEKEND_NOT_REQUESTED`
5. 통과하면 근무 형태(사무실·재택·휴일근무)와 지각을 계산해 저장 → `commit()` → 이력 `CLOCK_IN`

**신청 제출 → 취소**

`ApplicationsView` → `POST /applications` → `ApplicationService.create`

1. 날짜 형식 → 날짜 종류(연차·재택·OFF는 영업일, 휴일근무는 주말·공휴일) → 기한(전 영업일 17:00) → 재택·휴일근무의 IP·시간대 → 중복 → 잔여(연차·재택 횟수·OFF) 순서로 검사
2. 통과하면 저장. OFF는 만료가 가장 빠른 지급분을 이 신청에 연결
3. 제출 즉시 효력이 있고(PENDING도 유효), 리드가 반려하면 무효가 되며 소진한 OFF가 돌아옵니다.
4. 취소는 `POST /applications/:id/cancel`. 기한 전까지만 가능하며 서버가 계산한 `canCancel`이 true일 때만 버튼이 보입니다.

**검사와 저장이 끼어들지 않는 이유**

서비스는 "검사 → 변경"을 `await` 없이 이어서 실행하고 마지막에만 `await commit()`합니다. Node는 한 번에 한 작업만 실행하므로 같은 순간에 들어온 두 요청이 서로의 검사 결과를 깨뜨리지 못합니다(예: 마지막 연차 1일을 두 번 신청). 이 보장은 **백엔드 프로세스가 하나일 때만** 성립합니다.

## 9. 테스트 전략

| 종류 | 위치 | 범위 |
| --- | --- | --- |
| 단위 | `backend/src/rules/rules.spec.ts` 외 | 지각·점심 포함 근무시간·조퇴·연차 적립·OFF 만료·신청 기한·IP 정규화 등 경계값, 비밀 값 검사(`secret-check.spec.ts`), 로그인 시도 제한(`login-throttle.spec.ts`) |
| e2e | `backend/test/app.e2e-spec.ts` | 실제 Nest 앱 + supertest. 로그인·IP 차단·출퇴근 규칙·신청·반려/취소 시 잔여 복원·휴일근무→OFF 지급/만료·퇴근 누락·공휴일·IP 관리·PDF·정산·이력 필터·재시작 후 데이터 유지·깨진 파일 거부·이력 파일 덧붙이기/잘린 줄 복구/예전 형식 이전·로그인 잠금 |
| 타입 검사 | `frontend`의 `npm run build` | `vue-tsc`가 템플릿까지 검사 |

e2e는 임시 폴더를 데이터 폴더로 쓰고 `FakeClock`으로 시각을 고정하므로 **실행 시각과 상관없이 항상 같은 결과**가 나오며, 개발 중인 `backend/data`를 건드리지 않습니다. 프론트엔드의 자동화 테스트는 없습니다(README의 "아쉬운 점" 참고).

## 10. 배포 시 권장 구성 (구축하지는 않음)

이 저장소는 로컬 실행을 전제로 하며 Docker·CI·배포 스크립트는 포함하지 않습니다. 배포한다면 다음 구성을 권장합니다.

```
브라우저 ─▶ 리버스 프록시(nginx 등)
             ├─ /      → frontend/dist 정적 파일
             └─ /api   → 백엔드 1대 (127.0.0.1:3000)
```

- 프록시가 `X-Forwarded-For`에 실제 접속자 IP를 넣고, 백엔드는 `TRUST_PROXY`에 그 프록시를 지정합니다.
- 백엔드는 반드시 **1대, 1프로세스**로 실행합니다(JSON 저장소 특성).
- `backend/data/` 폴더를 정기적으로 백업하고, `JWT_SECRET`은 32자 이상의 임의 문자열로 바꿉니다. `NODE_ENV=production`으로 실행하면 약한 값은 서버가 거부합니다.
