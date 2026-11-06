# 시퀀스 다이어그램

근태관리 시스템의 **기능별 시퀀스 다이어그램**입니다. 기능마다 Mermaid 코드로 흐름을 그리고, 이미지(PNG)로 렌더링해 모았습니다. 코드는 실제 소스를 읽고 작성했으며, 분기마다 응답 코드(`400 TOO_EARLY` 등)를 함께 적었습니다.

> 관련 문서: [README](../README.md) · [architecture.md](architecture.md) (구조) · [api.md](api.md) (API·오류 코드) · [database.md](database.md) (데이터)

## 목차

**A. 인증·접속 제어**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [01](#seq-01) | 로그인 | FN-SYS-02 | `POST /api/auth/login`, `GET /api/auth/me` | 누구나 (공개 API) |
| [02](#seq-02) | 로그인 시도 제한 | 보안 요구 | `POST /api/auth/login` 내부 | 누구나 (공개 API) |
| [03](#seq-03) | 접속 IP·시간대·권한 검사 (모든 요청) | FN-SYS-01 | 로그인·상태 확인을 뺀 **모든 API** | 로그인한 사용자 (전역 가드 통과) |
| [04](#seq-04) | 로그인 상태 복원과 화면 이동 | 화면 접근 제어 | `GET /api/auth/me` | 누구나 |

**B. 출퇴근**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [05](#seq-05) | 출근 | FN-ATT-01, FN-ATT-04 | `POST /api/attendance/clock-in` | 로그인한 사용자 (전역 가드 통과) |
| [06](#seq-06) | 퇴근 | FN-ATT-02, FN-ATT-04 | `POST /api/attendance/clock-out` | 로그인한 사용자 (전역 가드 통과) |
| [07](#seq-07) | 퇴근 직접 입력과 출근 재시도 | FN-ATT-03 | `POST /api/attendance/manual-clock-out` | 로그인한 사용자 (전역 가드 통과) |
| [08](#seq-08) | 월별 출퇴근 기록 조회 | 출퇴근 조회 | `GET /api/attendance?month&userId` | 본인 (리드는 팀원 지정 가능) |

**C. 대시보드**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [09](#seq-09) | 내 대시보드 카드 | FN-DSH-02 | `GET /api/dashboard/me` | 로그인한 사용자 (전역 가드 통과) |
| [10](#seq-10) | 팀 보드 | FN-DSH-01 | `GET /api/dashboard/team` | 리드 |
| [11](#seq-11) | 미기록 건 조회 | FN-DSH-03 | `GET /api/dashboard/issues` | 본인 (리드는 팀 전체 가능) |

**D. 신청 (연차·재택·OFF·주말근무)**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [12](#seq-12) | 신청서 제출 | FN-REQ-01 | `POST /api/applications` | 로그인한 사용자 (전역 가드 통과) |
| [13](#seq-13) | 신청 목록 조회 | 신청 조회 | `GET /api/applications` | 본인 (팀 신청은 리드) |
| [14](#seq-14) | 신청 취소 | 신청 취소 | `POST /api/applications/:id/cancel` | 신청한 본인 |
| [15](#seq-15) | 신청 승인·반려 | FN-REQ-02 | `POST /api/applications/:id/approve`, `.../reject` | 리드 |
| [16](#seq-16) | 신청서 PDF 다운로드 | FN-REQ-03 | `GET /api/applications/:id/pdf` | 신청한 본인 또는 리드 |
| [17](#seq-17) | 내 연차·재택·OFF 잔여 조회 | FN-BAL-01 | `GET /api/balances/me` | 로그인한 사용자 (전역 가드 통과) |

**E. 정산·이력**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [18](#seq-18) | 월별 정산 | FN-STL-01 | `GET /api/settlement?month=YYYY-MM` | 본인 행 (리드는 팀 전체) |
| [19](#seq-19) | 이력 조회 | FR-LOG-01 | `GET /api/logs` | 본인 이력 (리드는 전체) |

**F. 리드 관리 (공휴일·접속 IP)**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [20](#seq-20) | 공휴일 조회 | 공휴일 관리 | `GET /api/holidays?year` | 로그인한 사용자 (화면은 리드 전용) |
| [21](#seq-21) | 공휴일 등록·삭제 | 공휴일 관리 | `POST /api/holidays`, `DELETE /api/holidays/:date` | 리드 |
| [22](#seq-22) | 연구실 접속 IP 목록 조회 | IP 관리 | `GET /api/allowed-ips` | 리드 |
| [23](#seq-23) | 연구실 접속 IP 등록 | IP 관리 | `POST /api/allowed-ips` | 리드 |
| [24](#seq-24) | 연구실 접속 IP 이름 수정 | IP 관리 | `PATCH /api/allowed-ips/:id` | 리드 |
| [25](#seq-25) | 연구실 접속 IP 삭제 | IP 관리 | `DELETE /api/allowed-ips/:id` | 리드 |

**G. 공통·운영**

| 번호 | 기능 | 요구사항 | API | 권한 |
| --- | --- | --- | --- | --- |
| [26](#seq-26) | 데이터 저장과 이력 기록 | 데이터 저장 (공통) | 모든 쓰기 기능 내부 | — |
| [27](#seq-27) | 서버 상태 확인 | 운영 | `GET /api/health` | 누구나 (공개 API) |

## 읽는 방법

**참여자**

| 이름 | 역할 |
| --- | --- |
| 사용자 / 리드 | 화면을 쓰는 사람. 역할은 팀원(MEMBER)과 리드(LEAD) |
| 화면 (…View) | 프론트엔드(Vue). `fetch`로 API를 호출하고 결과를 그린다 |
| AccessGuard | 모든 요청이 먼저 거치는 전역 가드 (03번) |
| …Controller | 요청 경로·입력 형식 검사(DTO)·권한(`@Roles`)만 담당하고 서비스에 위임 |
| …Service | 업무 규칙(기한, 잔여, 중복 등)을 검사하고 데이터를 바꾼다 |
| DataStore | 메모리 컬렉션 + JSON 파일 저장 (`commit()`, 26번) |
| ActivityLog | 이력 기록 (`APPLICATION_CREATE` 같은 행동 이름으로 남긴다, 26번) |

**표기**

- `break [조건]` 상자: 그 조건이면 **거기서 요청이 끝나고** 오류 응답을 돌려준다는 뜻입니다. 위에서 아래로 읽으면 검사 순서가 됩니다.
- `alt` / `else`: 경우에 따라 갈라지는 흐름, `opt`: 조건이 맞을 때만 일어나는 단계, `loop`: 반복, `par`: 동시에 요청.
- 실선 화살표는 호출·요청, 점선 화살표는 응답입니다. 노란 상자는 보충 설명입니다.
- 03번을 뺀 기능 다이어그램은 맨 위에 "전역 AccessGuard를 통과한 뒤 실행"이라고 적혀 있으며, 가드 단계는 생략했습니다. 리드 전용 API를 팀원이 호출하면 가드가 `403 FORBIDDEN`으로 막습니다.
- 다이어그램 안의 "NN번"은 이 문서의 해당 번호를 가리킵니다.

---

## A. 인증·접속 제어

<a id="seq-01"></a>

### 01. 로그인

아이디·비밀번호를 확인하고, 접속 IP·시간대를 검사한 뒤 토큰(JWT)을 발급합니다. 로그인 성공 직후 `/auth/me`로 내 정보와 접속 IP를 가져옵니다.

- **요구사항**: FN-SYS-02
- **API**: `POST /api/auth/login`, `GET /api/auth/me`
- **권한**: 누구나 (공개 API)
- **소스**: `backend/src/auth/auth.service.ts`, `frontend/src/views/LoginView.vue`, `frontend/src/stores/auth.ts`

![01. 로그인 시퀀스 다이어그램](sequence/01-login.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 01 로그인 (FN-SYS-02)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (LoginView)
    participant A as AuthController
    participant S as AuthService
    participant T as LoginThrottle
    participant X as AccessService
    participant D as DataStore
    participant L as ActivityLog

    U->>V: 아이디·비밀번호 입력 후 로그인
    V->>A: POST /api/auth/login (공개 API, 토큰 없이 호출)
    A->>S: login(loginId, password, ip)
    S->>T: assertAllowed(ip, loginId)
    break 잠금 중이면 (자세한 흐름은 02번)
        S-->>V: 429 TOO_MANY_ATTEMPTS (retryAfterSeconds)
    end
    S->>D: users에서 loginId로 계정 조회
    S->>S: scrypt로 비밀번호 검증 (없는 계정도 더미 해시로 같은 시간 소요)
    break 계정이 없거나 비밀번호가 틀리면
        S->>T: recordFailure(ip, loginId)
        S->>L: LOGIN_FAILED (이번에 잠기면 LOGIN_LOCKED도 기록)
        S-->>V: 401 INVALID_CREDENTIALS
    end
    S->>T: recordSuccess (해당 아이디의 실패 횟수 초기화)
    S->>X: isAllowed(userId, ip, now)
    X->>D: 연구실 IP 목록 / 오늘의 재택·주말근무 신청 조회
    X-->>S: 허용 여부
    break 연구실 IP도 아니고 신청한 IP·시간대도 아니면
        S->>L: ACCESS_DENIED
        S-->>V: 403 IP_NOT_ALLOWED
    end
    S->>L: LOGIN
    S->>S: JWT 발급 (sub = 사용자 id, 유효 12시간)
    S-->>V: 200 token, user
    V->>V: 토큰을 localStorage에 저장 (ta.token)
    V->>A: GET /api/auth/me (Bearer 토큰)
    A-->>V: user, ip, isLabIp
    V-->>U: 대시보드로 이동
```

</details>

[↑ 목차](#목차)

<a id="seq-02"></a>

### 02. 로그인 시도 제한

같은 IP·아이디로 10분 안에 5번 틀리면 10분간 잠그고(429), 한 IP 전체로는 20번까지만 허용합니다. 잠금 여부는 비밀번호 검증(scrypt) 전에 확인합니다.

- **요구사항**: 보안 요구
- **API**: `POST /api/auth/login` 내부
- **권한**: 누구나 (공개 API)
- **소스**: `backend/src/core/login-throttle.service.ts`

![02. 로그인 시도 제한 시퀀스 다이어그램](sequence/02-login-throttle.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 02 로그인 시도 제한 (무차별 대입 방지)
---
sequenceDiagram
    autonumber
    actor U as 사용자 (또는 공격자)
    participant S as AuthService
    participant T as LoginThrottle
    participant L as ActivityLog

    Note over T: 키 두 개를 센다 — (IP + 아이디) 5회, IP 전체 20회 (기간 10분, 잠금 10분)
    loop 비밀번호가 틀릴 때마다 (1~4번째)
        U->>S: 로그인 시도
        S->>T: assertAllowed(ip, loginId)
        T-->>S: 통과
        S->>T: recordFailure(ip, loginId)
        S->>L: LOGIN_FAILED
        S-->>U: 401 INVALID_CREDENTIALS
    end
    U->>S: 5번째 실패
    S->>T: recordFailure → 잠금 시작 (lockedUntil = 지금 + 10분)
    S->>L: LOGIN_FAILED, LOGIN_LOCKED (잠금은 시작할 때 한 번만 기록)
    S-->>U: 401 INVALID_CREDENTIALS
    U->>S: 잠긴 동안 다시 시도
    S->>T: assertAllowed(ip, loginId)
    T-->>U: 429 TOO_MANY_ATTEMPTS (retryAfterSeconds)
    Note over S,T: 비밀번호 검증(scrypt) 전에 막으므로 서버 CPU도 아낀다
    U->>S: 10분 뒤 다시 시도
    S->>T: assertAllowed → 통과
    Note over T: 로그인에 성공하면 해당 (IP + 아이디) 횟수만 지운다. IP 전체 횟수는 유지. 서버를 재시작하면 모두 초기화
```

</details>

[↑ 목차](#목차)

<a id="seq-03"></a>

### 03. 접속 IP·시간대·권한 검사 (모든 요청)

모든 요청이 컨트롤러에 닿기 전에 거치는 전역 가드입니다. 토큰 → 사용자 → 접속 IP·시간대 → 역할 순서로 확인하며, 연구실 IP는 상시 허용, 재택·주말근무는 신청한 IP·시간대에서만 허용합니다. 아래 기능 다이어그램은 이 단계를 통과한 뒤의 흐름입니다.

- **요구사항**: FN-SYS-01
- **API**: 로그인·상태 확인을 뺀 **모든 API**
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/auth/access.guard.ts`, `backend/src/core/access.service.ts`, `frontend/src/api/client.ts`, `frontend/src/App.vue`

![03. 접속 IP·시간대·권한 검사 (모든 요청) 시퀀스 다이어그램](sequence/03-access-guard.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 03 접속 IP·시간대·권한 검사 (모든 요청, FN-SYS-01)
---
sequenceDiagram
    autonumber
    participant V as 화면 (API 클라이언트)
    participant G as AccessGuard (전역)
    participant J as JwtService
    participant D as DataStore
    participant X as AccessService
    participant L as ActivityLog
    participant C as Controller

    V->>G: 요청 + Authorization Bearer 토큰
    alt 공개 API (@Public: 로그인, 상태 확인)
        G->>C: 검사 없이 통과
    else 로그인이 필요한 API
        G->>J: verifyAsync(token)
        break 토큰이 없거나 만료·위조
            G-->>V: 401 UNAUTHORIZED
            V->>V: clearSession() → 로그인 화면으로 이동
        end
        G->>D: users.get(토큰의 sub)
        break 사용자가 없으면
            G-->>V: 401 UNAUTHORIZED
        end
        G->>X: isAllowed(userId, 접속 IP, 지금)
        X->>D: 연구실 IP 목록 조회
        X->>D: 오늘의 재택·주말근무 신청 조회 (유효 상태 + 신청한 IP·시간대 일치?)
        X-->>G: 허용 여부
        break 연구실 IP도 아니고 신청한 IP·시간대도 아니면
            G->>L: ACCESS_DENIED (요청 경로)
            G-->>V: 403 IP_NOT_ALLOWED (ip)
            V->>V: session.blocked 설정 → "접속할 수 없습니다" 화면 (다시 시도 / 로그아웃)
        end
        G->>G: @Roles 확인
        break 리드 전용 API인데 팀원이면
            G-->>V: 403 FORBIDDEN
        end
        G->>C: req.user 설정 후 컨트롤러 실행
    end
```

</details>

[↑ 목차](#목차)

<a id="seq-04"></a>

### 04. 로그인 상태 복원과 화면 이동

새로고침해도 저장된 토큰으로 로그인 상태를 되살리고, 로그인 여부와 역할(리드 전용 화면)에 따라 이동할 화면을 정합니다.

- **요구사항**: 화면 접근 제어
- **API**: `GET /api/auth/me`
- **권한**: 누구나
- **소스**: `frontend/src/router.ts`, `frontend/src/stores/auth.ts`, `frontend/src/stores/session.ts`

![04. 로그인 상태 복원과 화면 이동 시퀀스 다이어그램](sequence/04-session-restore.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 04 로그인 상태 복원과 화면 이동 (새로고침·주소 직접 입력)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant R as Vue Router (beforeEach)
    participant SS as session 저장소
    participant A as API (GET /auth/me)
    participant V as 화면

    U->>R: 새로고침 또는 주소 직접 입력
    opt 아직 복원하지 않았다면 (session.ready = false)
        R->>SS: localStorage의 토큰 읽기 (ta.token)
        opt 토큰이 있으면
            R->>A: GET /api/auth/me
            alt 성공
                A-->>R: user, ip, isLabIp
                R->>SS: user · ip · isLabIp 저장, blocked 해제
            else 401 (토큰 만료)
                A-->>R: 401
                R->>SS: clearSession() (토큰 삭제)
            else 403 IP_NOT_ALLOWED
                A-->>R: 403
                R->>SS: blocked 기록 (user는 비어 있음)
            end
        end
        R->>SS: ready = true
    end
    alt 공개 화면 (/login)
        R-->>V: 이미 로그인한 상태면 대시보드로, 아니면 로그인 화면 표시
    else 로그인이 필요한 화면
        alt 로그인 정보 없음
            R-->>V: /login 으로 이동
        else 리드 전용 화면 (공휴일, 접속 IP)인데 팀원
            R-->>V: 대시보드로 이동
        else
            R-->>V: 요청한 화면 표시
        end
    end
    Note over V: 사용 중 토큰이 지워지면 (만료 401, 로그아웃) App.vue가 감시하다가 어느 화면에서든 /login 으로 이동
```

</details>

[↑ 목차](#목차)

## B. 출퇴근

<a id="seq-05"></a>

### 05. 출근

07:00부터 출근할 수 있고 10:00:00을 넘기면 지각입니다. 지난 날 퇴근이 비어 있으면 막히고, 주말·공휴일은 신청한 날짜·시간대·IP에서만 출근할 수 있습니다.

- **요구사항**: FN-ATT-01, FN-ATT-04
- **API**: `POST /api/attendance/clock-in`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/attendance/attendance.service.ts`, `backend/src/rules/attendance.rules.ts`

![05. 출근 시퀀스 다이어그램](sequence/05-clock-in.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 05 출근 (FN-ATT-01, FN-ATT-04)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (DashboardView)
    participant A as AttendanceController
    participant S as AttendanceService
    participant H as HolidayService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: [출근] 클릭
    V->>A: POST /api/attendance/clock-in
    A->>S: clockIn(user, ip)
    S->>D: 지난 날 중 퇴근이 비어 있는 기록 조회
    break 퇴근을 안 찍은 날이 있으면
        S-->>V: 409 MISSING_CLOCK_OUT (records) → 07번
    end
    break 07:00 이전이면
        S-->>V: 400 TOO_EARLY
    end
    S->>D: 오늘 출근 기록 조회
    break 이미 출근했으면
        S-->>V: 409 ALREADY_CLOCKED_IN
    end
    S->>D: 오늘의 유효 신청 조회 (취소·반려 제외)
    S->>H: 오늘이 영업일인가?
    alt 주말·공휴일
        break 주말근무 신청의 날짜·시간대·IP와 맞지 않으면
            S-->>V: 403 WEEKEND_NOT_REQUESTED
        end
        Note over S: workType = WEEKEND_WORK (지각 판정 없음)
    else 영업일이고 재택 신청이 있으면
        Note over S: workType = REMOTE
    else 영업일
        Note over S: workType = OFFICE
    end
    S->>S: 지각 판정 (10:00:00 초과, 정각은 정상)
    S->>D: 출근 기록 저장 (시각, IP, 근무 유형, 지각 여부)
    S->>D: commit() 파일 저장
    S->>L: CLOCK_IN
    S-->>V: 200 출근 기록
    V->>V: 대시보드 다시 불러오기, "출근을 등록했습니다."
```

</details>

[↑ 목차](#목차)

<a id="seq-06"></a>

### 06. 퇴근

16:00부터 퇴근할 수 있습니다(반일 OFF 사용일은 제외). 점심은 11:30~12:30이 전부 근무 구간에 들어올 때만 1시간 차감하고, 8시간 미만이면 조퇴입니다. 휴일 근무는 반일 OFF를 지급합니다.

- **요구사항**: FN-ATT-02, FN-ATT-04
- **API**: `POST /api/attendance/clock-out`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/attendance/attendance.service.ts`, `backend/src/rules/attendance.rules.ts`

![06. 퇴근 시퀀스 다이어그램](sequence/06-clock-out.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 06 퇴근 (FN-ATT-02, FN-ATT-04)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (DashboardView)
    participant A as AttendanceController
    participant S as AttendanceService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: [퇴근] 클릭
    V->>A: POST /api/attendance/clock-out
    A->>S: clockOut(user, ip)
    S->>D: 오늘 출근 기록 조회
    break 출근 기록이 없으면
        S-->>V: 404 NOT_CLOCKED_IN
    end
    break 이미 퇴근했으면
        S-->>V: 409 ALREADY_CLOCKED_OUT
    end
    S->>D: 오늘의 반일 OFF 신청 조회
    break 16:00 이전이면 (반일 OFF 사용일은 제한 없음)
        S-->>V: 400 TOO_EARLY
    end
    opt 휴일 근무 기록이면
        S->>D: 주말근무 신청 조회
        break 날짜·시간대·IP가 신청과 맞지 않으면
            S-->>V: 403 WEEKEND_NOT_REQUESTED
        end
    end
    S->>S: 근무시간 = 퇴근 − 출근 (점심 11:30~12:30이 전부 포함될 때만 1시간 차감)
    S->>S: 조퇴 판정 (8시간 미만, 반일 OFF 사용일은 4시간 미만, 휴일 근무는 제외)
    S->>D: 퇴근 시각·IP·근무분·조퇴 여부 저장
    opt 휴일 근무였다면
        S->>D: 반일 OFF 1개 지급 (지급일부터 30일 뒤 만료)
    end
    S->>D: commit() 파일 저장
    S->>L: CLOCK_OUT
    S-->>V: 200 퇴근 기록
    V->>V: 대시보드 다시 불러오기, "퇴근을 등록했습니다."
```

</details>

[↑ 목차](#목차)

<a id="seq-07"></a>

### 07. 퇴근 직접 입력과 출근 재시도

퇴근을 찍지 않은 날이 있으면 출근이 거절되고(409), 직접 입력 창에서 퇴근 시각을 채운 뒤 출근을 자동으로 다시 시도합니다. 지난 날의 기록만 입력할 수 있고 "직접 입력"으로 표시됩니다.

- **요구사항**: FN-ATT-03
- **API**: `POST /api/attendance/manual-clock-out`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/attendance/attendance.service.ts`, `frontend/src/components/ManualClockOutModal.vue`, `frontend/src/views/DashboardView.vue`

![07. 퇴근 직접 입력과 출근 재시도 시퀀스 다이어그램](sequence/07-manual-clock-out.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 07 퇴근 직접 입력과 출근 재시도 (FN-ATT-03)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (DashboardView)
    participant M as 직접 입력 창 (모달)
    participant A as AttendanceController
    participant S as AttendanceService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: [출근] 클릭
    V->>A: POST /api/attendance/clock-in
    A-->>V: 409 MISSING_CLOCK_OUT (퇴근이 빈 날짜 목록)
    V->>V: 목록 저장, 입력이 끝나면 출근을 다시 시도하도록 표시
    V->>M: 퇴근 시각 직접 입력 창 표시
    Note over V,M: 대시보드의 미기록 목록에서 [직접 입력]을 눌러도 같은 창이 열린다 (이 경우 출근 재시도는 없음)
    U->>M: 날짜별 퇴근 시각 입력 후 저장
    loop 위에서부터 차례로 (실패하면 그 행에서 멈춤)
        M->>A: POST /api/attendance/manual-clock-out (attendanceId, time)
        A->>S: manualClockOut(user, ip, attendanceId, time)
        S->>D: 본인의 출근 기록 조회
        alt 기록 없음 / 이미 퇴근함 / 오늘 이후 날짜 / 퇴근이 출근보다 이르거나 같음
            S-->>M: 404 NOT_FOUND, 409 ALREADY_CLOCKED_OUT, 400 NOT_PAST_DAY, 400 INVALID_TIME
            M->>M: 해당 행에 오류 표시하고 중단
        else 정상
            S->>S: 근무시간·조퇴 계산 (휴일 근무였다면 반일 OFF 지급)
            S->>D: 퇴근 시각 저장 (직접 입력 표시), commit()
            S->>L: CLOCK_OUT_MANUAL
            S-->>M: 200 퇴근 기록
        end
    end
    M-->>V: 모두 저장됨
    V->>A: 대시보드 새로고침 (내 카드·미기록)
    V->>A: POST /api/attendance/clock-in (자동 재시도)
    A-->>V: 200 출근 기록
    V-->>U: "출근을 등록했습니다."
```

</details>

[↑ 목차](#목차)

<a id="seq-08"></a>

### 08. 월별 출퇴근 기록 조회

정산 화면에서 사람을 고르면 그 달의 일자별 출퇴근 기록을 보여줍니다. 팀원은 본인 기록만, 리드는 누구든 볼 수 있습니다.

- **요구사항**: 출퇴근 조회
- **API**: `GET /api/attendance?month&userId`
- **권한**: 본인 (리드는 팀원 지정 가능)
- **소스**: `backend/src/attendance/attendance.controller.ts`, `frontend/src/views/SettlementView.vue`

![08. 월별 출퇴근 기록 조회 시퀀스 다이어그램](sequence/08-attendance-month.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 08 월별 출퇴근 기록 조회
---
sequenceDiagram
    autonumber
    actor U as 사용자 (팀원 또는 리드)
    participant V as 화면 (SettlementView)
    participant A as AttendanceController
    participant S as AttendanceService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 정산 화면에서 사람(행)을 선택 — 18번의 상세 보기
    V->>A: GET /api/attendance?month=YYYY-MM&userId=대상
    A->>A: targetId = userId 또는 본인
    break 다른 사람의 기록인데 리드가 아니면
        A-->>V: 403 FORBIDDEN
    end
    A->>S: listByMonth(targetId, month)
    S->>D: 해당 월의 출퇴근 기록 조회 (날짜 오름차순)
    S-->>V: 일자별 출근·퇴근 시각, 근무 유형, 지각·조퇴, 직접 입력 여부
    V-->>U: 월별 상세 표시
```

</details>

[↑ 목차](#목차)

## C. 대시보드

<a id="seq-09"></a>

### 09. 내 대시보드 카드

오늘의 출퇴근 기록, 오늘 대상인 내 신청, 공휴일 여부, 연차·재택·OFF 잔여를 한 번에 보여줍니다.

- **요구사항**: FN-DSH-02
- **API**: `GET /api/dashboard/me`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/dashboard/dashboard.service.ts`, `frontend/src/views/DashboardView.vue`

![09. 내 대시보드 카드 시퀀스 다이어그램](sequence/09-dashboard-me.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 09 내 대시보드 카드 (FN-DSH-02)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (DashboardView)
    participant A as DashboardController
    participant S as DashboardService
    participant H as HolidayService
    participant B as BalanceService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 대시보드 열기 (출근·퇴근·직접 입력 뒤에는 자동 새로고침)
    par 동시에 요청
        V->>A: GET /api/dashboard/me
    and
        V->>A: GET /api/dashboard/issues (본인 미기록 — 11번)
    end
    A->>S: myCard(user)
    S->>D: 오늘 내 출퇴근 기록 조회
    S->>D: 오늘이 대상일인 내 유효 신청 조회
    S->>H: 영업일 여부, 공휴일 이름
    S->>B: forUser(user, 오늘) — 연차·재택·OFF 잔여 (17번)
    S-->>V: now, today, isBusinessDay, holidayName, attendance, applications, balances
    V-->>U: 오늘의 상태 카드 표시 (현재 시각은 화면에서 1초마다 갱신)
    opt 리드라면
        V->>A: GET /api/dashboard/team (10번), GET /api/dashboard/issues?scope=team (11번)
    end
```

</details>

[↑ 목차](#목차)

<a id="seq-10"></a>

### 10. 팀 보드

오늘 팀원별 상태(근무 중, 퇴근, 연차, 반일 OFF, 재택, 주말근무 예정, 휴무일, 미출근)를 한눈에 보여줍니다.

- **요구사항**: FN-DSH-01
- **API**: `GET /api/dashboard/team`
- **권한**: 리드
- **소스**: `backend/src/dashboard/dashboard.service.ts`, `frontend/src/views/DashboardView.vue`

![10. 팀 보드 시퀀스 다이어그램](sequence/10-team-board.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 10 팀 보드 — 오늘 팀원별 상태 (FN-DSH-01, 리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (DashboardView)
    participant A as DashboardController
    participant S as DashboardService
    participant H as HolidayService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). @Roles('LEAD')라 팀원이 호출하면 403 FORBIDDEN
    U->>V: 대시보드 열기
    V->>A: GET /api/dashboard/team
    A->>S: teamBoard()
    S->>H: 오늘이 영업일인가?
    S->>D: 오늘 출퇴근 기록 전체 / 오늘 유효 신청 전체 / 사용자 목록
    loop 팀원마다 (리드 먼저, 이름순)
        S->>S: boardStatus(출퇴근 기록, 신청 종류, 영업일)
    end
    Note right of S: 상태 — 근무 중, 퇴근, 연차, 반일 OFF, 재택, 주말근무 예정, 휴무일, 미출근
    S-->>V: today, isBusinessDay, members (상태, 출퇴근 시각, 지각·조퇴)
    V-->>U: 팀원별 상태 보드 표시
```

</details>

[↑ 목차](#목차)

<a id="seq-11"></a>

### 11. 미기록 건 조회

퇴근이 비어 있는 지난 날과 최근 30일 안에 퇴근을 직접 입력한 기록을 보여주고, 각 행에서 바로 직접 입력할 수 있습니다.

- **요구사항**: FN-DSH-03
- **API**: `GET /api/dashboard/issues`
- **권한**: 본인 (리드는 팀 전체 가능)
- **소스**: `backend/src/dashboard/dashboard.service.ts`, `backend/src/attendance/attendance.service.ts`

![11. 미기록 건 조회 시퀀스 다이어그램](sequence/11-issues.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 11 미기록 건 조회 (FN-DSH-03)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (DashboardView)
    participant A as DashboardController
    participant S as DashboardService
    participant AT as AttendanceService

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    V->>A: GET /api/dashboard/issues (scope 생략 = 본인, 리드는 scope=team 가능)
    break scope=team인데 리드가 아니면
        A-->>V: 403 FORBIDDEN
    end
    A->>S: issues(user, scope)
    S->>AT: findMissing(오늘, userId) — 지난 날 중 퇴근이 비어 있는 기록
    S->>AT: findManualEntries(오늘, userId) — 최근 30일 안에 퇴근을 직접 입력한 기록
    S-->>V: missing 목록, manual 목록
    V-->>U: 미기록 목록 (행마다 [직접 입력] 버튼) + 최근 직접 입력 내역
    U->>V: [직접 입력] 클릭
    Note over V: 퇴근 시각 직접 입력 창이 열린다 — 07번
```

</details>

[↑ 목차](#목차)

## D. 신청 (연차·재택·OFF·주말근무)

<a id="seq-12"></a>

### 12. 신청서 제출

신청 기한(대상일의 전 영업일 17:00), 날짜 종류(영업일·휴일), 중복, 잔여 횟수(연차·재택 월 2회·OFF)를 차례로 검사하고 저장합니다. 검사와 저장 사이에 await가 없어 동시 신청이 끼어들 수 없습니다.

- **요구사항**: FN-REQ-01
- **API**: `POST /api/applications`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/applications/application.service.ts`, `backend/src/rules/application.rules.ts`, `frontend/src/views/ApplicationsView.vue`

![12. 신청서 제출 시퀀스 다이어그램](sequence/12-application-create.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 12 신청서 제출 (FN-REQ-01)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (ApplicationsView)
    participant A as ApplicationController
    participant S as ApplicationService
    participant H as HolidayService
    participant B as BalanceService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 유형(연차·재택·OFF·주말근무), 대상일, 사유 입력 후 제출 (재택·주말근무는 접속 IP와 시간대도 입력)
    V->>A: POST /api/applications
    A->>A: ValidationPipe로 형식 검사 (잘못되면 400)
    A->>S: create(user, input, ip)
    S->>H: 영업일 판별 함수 준비
    break 대상일 형식이 올바르지 않으면
        S-->>V: 400 INVALID_DATE
    end
    break 주말근무인데 대상일이 영업일이면
        S-->>V: 400 NOT_NON_BUSINESS_DAY
    end
    break 연차·재택·OFF인데 대상일이 주말·공휴일이면
        S-->>V: 400 NOT_BUSINESS_DAY
    end
    break 지금이 대상일의 전 영업일 17:00를 지났으면
        S-->>V: 400 DEADLINE_PASSED
    end
    opt 재택·주말근무
        S->>S: IP 형식, 시간 형식(HH:mm), 시작 < 종료 검사
        S-->>V: 위반 시 400 INVALID_IP, 400 INVALID_TIME
    end
    S->>D: 같은 날짜의 유효 신청(승인·대기) 조회
    break 이미 있으면
        S-->>V: 409 DUPLICATE
    end
    alt 연차
        S->>B: forUser(user, 오늘) — 잔여 연차 (17번)
        S-->>V: 잔여가 1 미만이면 400 NO_BALANCE
    else 재택
        S->>D: 대상 월의 재택 신청 수 조회
        S-->>V: 월 2회를 이미 썼다면 400 NO_BALANCE
    else OFF
        S->>D: 대상일에 쓸 수 있는 OFF 중 만료가 가장 빠른 것 선택
        S-->>V: 없으면 400 NO_BALANCE
    end
    S->>D: 신청 저장 (상태 PENDING)
    opt OFF 신청
        S->>D: 선택한 OFF를 이 신청에 연결 (사용 처리)
    end
    S->>D: commit() 파일 저장
    S->>L: APPLICATION_CREATE
    S-->>V: 200 신청 정보
    V->>V: "신청했습니다." 입력 칸 비우고 목록·잔여 다시 불러오기
    Note over S: 검사부터 저장까지 중간에 await가 없어 동시에 들어온 신청이 끼어들 수 없다
```

</details>

[↑ 목차](#목차)

<a id="seq-13"></a>

### 13. 신청 목록 조회

내 신청 또는 팀 전체 신청을 월·상태로 거릅니다. 각 신청마다 취소 가능 여부(`canCancel`)와 승인·반려 가능 여부(`canDecide`)를 서버가 계산해 내려줍니다.

- **요구사항**: 신청 조회
- **API**: `GET /api/applications`
- **권한**: 본인 (팀 신청은 리드)
- **소스**: `backend/src/applications/application.service.ts`, `frontend/src/views/ApplicationsView.vue`

![13. 신청 목록 조회 시퀀스 다이어그램](sequence/13-application-list.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 13 신청 목록 조회
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (ApplicationsView)
    participant A as ApplicationController
    participant S as ApplicationService
    participant H as HolidayService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 신청 화면 열기 / 범위(내 신청·팀 신청), 월, 상태 필터 변경
    V->>A: GET /api/applications?scope&month&status
    A->>S: list(user, scope, month, status)
    break scope=team인데 리드가 아니면
        S-->>V: 403 FORBIDDEN
    end
    S->>D: 조건에 맞는 신청 조회 (대상일 내림차순, 최대 300건)
    S->>H: 영업일 판별 함수 준비
    loop 신청마다
        S->>S: 신청 기한(전 영업일 17:00), canCancel(본인·유효·기한 전), canDecide(리드·타인·대기) 계산
    end
    S-->>V: 신청 목록
    V-->>U: 목록 표시 — 상태에 맞는 버튼만 노출 (취소 / 승인·반려 / PDF)
```

</details>

[↑ 목차](#목차)

<a id="seq-14"></a>

### 14. 신청 취소

신청 기한 전까지 본인이 취소할 수 있고, 확인 창을 거칩니다. 사용한 OFF가 있으면 돌려줍니다.

- **요구사항**: 신청 취소
- **API**: `POST /api/applications/:id/cancel`
- **권한**: 신청한 본인
- **소스**: `backend/src/applications/application.service.ts`, `frontend/src/components/ConfirmModal.vue`

![14. 신청 취소 시퀀스 다이어그램](sequence/14-application-cancel.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 14 신청 취소
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (ApplicationsView)
    participant C as 확인 창 (ConfirmModal)
    participant A as ApplicationController
    participant S as ApplicationService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 신청 행의 [취소] 클릭
    V->>C: "신청을 취소할까요?" 확인 창 표시
    alt 닫기
        C-->>V: 아무 일도 일어나지 않음
    else 확인
        C->>V: confirmCancel()
        V->>A: POST /api/applications/:id/cancel
        A->>S: cancel(user, id, ip)
        S->>D: 본인의 신청 조회
        break 신청이 없으면
            S-->>V: 404 NOT_FOUND
        end
        break 이미 반려·취소된 신청이면
            S-->>V: 409 NOT_CANCELLABLE
        end
        break 신청 기한(전 영업일 17:00)이 지났으면
            S-->>V: 400 DEADLINE_PASSED
        end
        S->>D: 상태를 CANCELLED로 변경
        S->>D: 이 신청이 쓴 OFF가 있으면 돌려줌 (연결 해제)
        S->>D: commit() 파일 저장
        S->>L: APPLICATION_CANCEL
        S-->>V: 200 신청 정보
        V->>V: 목록과 잔여 다시 불러오기
    end
```

</details>

[↑ 목차](#목차)

<a id="seq-15"></a>

### 15. 신청 승인·반려

리드가 대기 중인 신청을 승인하거나 사유와 함께 반려합니다. 본인 신청은 처리할 수 없고, 반려하면 사용한 OFF를 돌려줍니다.

- **요구사항**: FN-REQ-02
- **API**: `POST /api/applications/:id/approve`, `.../reject`
- **권한**: 리드
- **소스**: `backend/src/applications/application.service.ts`, `backend/src/applications/application.controller.ts`

![15. 신청 승인·반려 시퀀스 다이어그램](sequence/15-application-decide.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 15 신청 승인·반려 (FN-REQ-02, 리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (ApplicationsView)
    participant A as ApplicationController
    participant S as ApplicationService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). @Roles('LEAD')라 팀원이 호출하면 403 FORBIDDEN
    U->>V: 팀 신청 목록에서 대기 중인 신청 선택
    alt 승인
        U->>V: [승인] 클릭
        V->>A: POST /api/applications/:id/approve
    else 반려
        U->>V: [반려] 클릭 → 사유 입력 창에서 사유 입력 후 확인
        V->>A: POST /api/applications/:id/reject (note)
    end
    A->>S: decide(lead, id, 승인 또는 반려, note, ip)
    S->>D: 신청 조회
    break 신청이 없으면
        S-->>V: 404 NOT_FOUND
    end
    break 본인 신청이면
        S-->>V: 403 SELF_DECISION
    end
    break 대기(PENDING) 상태가 아니면
        S-->>V: 409 ALREADY_DECIDED
    end
    alt 승인
        S->>D: 상태 APPROVED, 처리자·처리 시각·메모 기록
    else 반려
        S->>D: 상태 REJECTED, 처리자·처리 시각·사유 기록
        S->>D: 이 신청이 쓴 OFF가 있으면 돌려줌
    end
    S->>D: commit() 파일 저장
    S->>L: APPLICATION_APPROVE 또는 APPLICATION_REJECT
    S-->>V: 200 신청 정보
    V->>V: 목록과 잔여 다시 불러오기
```

</details>

[↑ 목차](#목차)

<a id="seq-16"></a>

### 16. 신청서 PDF 다운로드

신청서를 PDF로 만들어 내려받습니다. 토큰이 필요한 파일이라 화면이 fetch로 받아 Blob 다운로드를 실행합니다.

- **요구사항**: FN-REQ-03
- **API**: `GET /api/applications/:id/pdf`
- **권한**: 신청한 본인 또는 리드
- **소스**: `backend/src/applications/application-pdf.service.ts`, `frontend/src/api/client.ts`

![16. 신청서 PDF 다운로드 시퀀스 다이어그램](sequence/16-application-pdf.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 16 신청서 PDF 다운로드 (FN-REQ-03)
---
sequenceDiagram
    autonumber
    actor U as 사용자 (본인 또는 리드)
    participant V as 화면 (ApplicationsView)
    participant A as ApplicationController
    participant S as ApplicationService
    participant P as ApplicationPdfService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 신청 행의 [PDF] 클릭
    V->>A: GET /api/applications/:id/pdf (Bearer 토큰 포함 fetch)
    A->>S: renderPdf(user, id, ip)
    S->>D: 신청, 신청자, 처리자 조회
    break 신청이 없거나 (본인도 리드도 아니면)
        S-->>V: 404 NOT_FOUND
    end
    S->>P: render(신청, 신청자, 처리자, 출력 시각)
    P-->>S: PDF 바이너리
    S->>L: APPLICATION_PDF
    S-->>A: 파일 내용, 파일 이름
    A-->>V: 200 application/pdf + Content-Disposition(한글 파일 이름)
    V->>V: Blob으로 받아 임시 링크를 만들어 브라우저 다운로드 실행
    V-->>U: 근태신청서_이름_대상일.pdf 저장
```

</details>

[↑ 목차](#목차)

<a id="seq-17"></a>

### 17. 내 연차·재택·OFF 잔여 조회

연차는 입사일 기준 매월 +1일 적립, 재택은 월 2회(이월 없음), OFF는 지급일부터 30일간 유효합니다. 같은 계산을 대시보드 카드와 월별 정산도 재사용합니다.

- **요구사항**: FN-BAL-01
- **API**: `GET /api/balances/me`
- **권한**: 로그인한 사용자 (전역 가드 통과)
- **소스**: `backend/src/core/balance.service.ts`, `backend/src/rules/balance.rules.ts`

![17. 내 연차·재택·OFF 잔여 조회 시퀀스 다이어그램](sequence/17-balances.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 17 내 연차·재택·OFF 잔여 조회 (FN-BAL-01)
---
sequenceDiagram
    autonumber
    actor U as 사용자
    participant V as 화면 (ApplicationsView)
    participant A as BalanceController
    participant B as BalanceService
    participant R as computeBalances (규칙)
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 신청 화면 열기 (제출·취소·승인·반려 뒤에도 다시 조회)
    V->>A: GET /api/balances/me
    A->>B: forUser(user, 오늘)
    B->>D: 유효 신청(반려·취소 제외)과 OFF 지급분 조회
    B->>R: computeBalances(입사일, 기준일, 신청, OFF 지급분)
    R->>R: 연차 = 입사일 기준 매월 +1일 적립 − 사용한 연차
    R->>R: 재택 = 이번 달 2회 − 이번 달 사용 (이월 없음)
    R->>R: OFF = 기준일에 유효한 미사용 지급분 (지급일부터 30일), 가장 빨리 만료되는 날짜
    R-->>B: annual, remote, off
    B-->>V: 연차·재택·OFF 잔여
    V-->>U: 잔여 표시
    Note over B: 같은 계산을 대시보드 카드(09)와 월별 정산(18)도 재사용한다
```

</details>

[↑ 목차](#목차)

## E. 정산·이력

<a id="seq-18"></a>

### 18. 월별 정산

월별 근무일·근무시간·지각·조퇴·직접 입력·퇴근 누락 건수와 기준일의 잔여를 집계합니다. 행을 누르면 일자별 상세(08번)를 보여줍니다.

- **요구사항**: FN-STL-01
- **API**: `GET /api/settlement?month=YYYY-MM`
- **권한**: 본인 행 (리드는 팀 전체)
- **소스**: `backend/src/settlement/settlement.service.ts`, `frontend/src/views/SettlementView.vue`

![18. 월별 정산 시퀀스 다이어그램](sequence/18-settlement.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 18 월별 정산 (FN-STL-01)
---
sequenceDiagram
    autonumber
    actor U as 사용자 (팀원 또는 리드)
    participant V as 화면 (SettlementView)
    participant A as SettlementController
    participant S as SettlementService
    participant B as BalanceService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 정산 화면 열기 / 월 변경
    V->>A: GET /api/settlement?month=YYYY-MM
    A->>A: month 형식 검사 (잘못되면 400)
    A->>S: monthly(user, month)
    S->>S: 기준일 = 월말 (이번 달이면 오늘)
    S->>D: 대상 사용자 조회 (리드는 팀 전체, 팀원은 본인만)
    S->>D: 해당 월의 출퇴근 기록 조회
    S->>B: forUsers(사용자들, 기준일, 월말) — 기준일의 연차·재택·OFF 잔여
    B-->>S: 사용자별 잔여
    loop 사용자마다
        S->>S: 근무일, 휴일근무일, 재택일, 근무시간, 지각·조퇴·직접입력·퇴근누락 건수 집계
    end
    S-->>V: month, asOf, rows
    V-->>U: 정산 표 표시
    opt 행 선택
        U->>V: 사람(행) 클릭
        V->>A: GET /api/attendance?month&userId — 일자별 상세 (08번)
    end
```

</details>

[↑ 목차](#목차)

<a id="seq-19"></a>

### 19. 이력 조회

접속·출퇴근·신청·설정 분류, 사용자, 기간으로 거르고 날짜별로 묶어 보여줍니다. "더 보기"는 마지막 id보다 오래된 이력을 이어서 가져옵니다.

- **요구사항**: FR-LOG-01
- **API**: `GET /api/logs`
- **권한**: 본인 이력 (리드는 전체)
- **소스**: `backend/src/logs/logs.service.ts`, `frontend/src/views/LogsView.vue`

![19. 이력 조회 시퀀스 다이어그램](sequence/19-logs.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 19 이력 조회 (FR-LOG-01)
---
sequenceDiagram
    autonumber
    actor U as 사용자 (팀원 또는 리드)
    participant V as 화면 (LogsView)
    participant A as LogsController
    participant S as LogsService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고
    U->>V: 이력 화면 열기
    opt 리드라면
        V->>A: GET /api/dashboard/team (사용자 필터에 쓸 팀원 목록, 10번)
    end
    V->>A: GET /api/logs?limit&category&userId&from&to
    A->>S: list(user, filter)
    break 날짜 형식이 올바르지 않거나 시작일이 종료일보다 늦으면
        S-->>V: 400 INVALID_DATE, 400 INVALID_RANGE
    end
    S->>D: 이력 조회 — 팀원은 본인 것만, 리드는 전체 (사용자 필터 가능)
    S->>S: 분류(접속·출퇴근·신청·설정), 기간(KST), 이전 페이지 위치(before) 조건으로 거르기
    S->>S: 최신순 정렬, limit개만 (기본 100)
    S-->>V: 이력 목록 (행동, 분류, 사용자, IP, 상세, 시각)
    V-->>U: 분류 탭·날짜별 묶음으로 표시, 접속 실패·차단은 경고 색
    U->>V: 필터 변경 또는 [더 보기]
    V->>A: GET /api/logs (필터 + 마지막 id를 before로)
    Note over V: 요청마다 번호를 붙여, 필터를 바꾸는 사이 늦게 도착한 이전 응답은 버린다
```

</details>

[↑ 목차](#목차)

## F. 리드 관리 (공휴일·접속 IP)

<a id="seq-20"></a>

### 20. 공휴일 조회

연도별 공휴일 목록을 보여줍니다. 공휴일은 코드로 계산하지 않고 데이터 파일에 저장하며, 신청 기한과 휴일 근무 판정에 쓰입니다.

- **요구사항**: 공휴일 관리
- **API**: `GET /api/holidays?year`
- **권한**: 로그인한 사용자 (화면은 리드 전용)
- **소스**: `backend/src/holidays/holiday-admin.service.ts`, `backend/src/core/holiday.service.ts`, `frontend/src/views/HolidaysView.vue`

![20. 공휴일 조회 시퀀스 다이어그램](sequence/20-holidays-list.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 20 공휴일 조회
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (HolidaysView)
    participant A as HolidaysController
    participant S as HolidayAdminService
    participant H as HolidayService

    Note over V,A: 전역 AccessGuard(JWT·IP·역할)를 통과한 뒤 실행 — 03번 참고. 화면은 리드 전용이고 조회 API 자체는 로그인한 누구나 호출할 수 있다
    U->>V: 공휴일 화면 열기 / 연도 변경
    V->>A: GET /api/holidays?year=YYYY
    A->>S: list(year)
    S->>H: listByYear(year)
    H-->>S: 해당 연도의 공휴일 (날짜 오름차순)
    S-->>V: 날짜, 이름 목록
    V-->>U: 공휴일 목록 표시
    Note over H: 공휴일은 코드로 계산하지 않고 데이터 파일에 저장 — 신청 기한·휴일 근무 판정에 쓰인다
```

</details>

[↑ 목차](#목차)

<a id="seq-21"></a>

### 21. 공휴일 등록·삭제

리드가 공휴일을 등록(같은 날짜면 이름 수정)하거나 삭제합니다. 이미 기록된 판정이 소급해서 달라지지 않도록 오늘 이전 날짜는 바꿀 수 없습니다.

- **요구사항**: 공휴일 관리
- **API**: `POST /api/holidays`, `DELETE /api/holidays/:date`
- **권한**: 리드
- **소스**: `backend/src/holidays/holiday-admin.service.ts`, `frontend/src/views/HolidaysView.vue`

![21. 공휴일 등록·삭제 시퀀스 다이어그램](sequence/21-holidays-edit.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 21 공휴일 등록·삭제 (리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (HolidaysView)
    participant C as 확인 창 (ConfirmModal)
    participant A as HolidaysController
    participant S as HolidayAdminService
    participant H as HolidayService
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). @Roles('LEAD')라 팀원이 호출하면 403 FORBIDDEN
    alt 등록
        U->>V: 날짜와 이름 입력 후 [등록]
        V->>A: POST /api/holidays (date, name)
        A->>S: add(user, ip, input)
    else 삭제
        U->>V: 공휴일 행의 [삭제] 클릭
        V->>C: 삭제 확인 창
        C->>V: 확인
        V->>A: DELETE /api/holidays/:date
        A->>S: remove(user, ip, date)
    end
    S->>S: assertChangeable(date)
    break 날짜 형식이 올바르지 않으면
        S-->>V: 400 INVALID_DATE
    end
    break 오늘 또는 오늘 이전 날짜이면 (이미 기록된 판정이 소급해서 달라질 수 있음)
        S-->>V: 400 PAST_DATE
    end
    alt 등록
        S->>H: upsert(date, name) — 있으면 이름 수정, 없으면 추가, commit()
        S->>L: HOLIDAY_ADD
    else 삭제
        S->>H: remove(date), commit()
        S->>L: HOLIDAY_REMOVE
    end
    S-->>V: 200
    V->>V: 공휴일 목록 다시 불러오기
```

</details>

[↑ 목차](#목차)

<a id="seq-22"></a>

### 22. 연구실 접속 IP 목록 조회

등록된 연구실 IP를 보여주고 지금 접속 중인 IP에 표시를 붙입니다.

- **요구사항**: IP 관리
- **API**: `GET /api/allowed-ips`
- **권한**: 리드
- **소스**: `backend/src/allowed-ips/allowed-ips.service.ts`, `frontend/src/views/AllowedIpsView.vue`

![22. 연구실 접속 IP 목록 조회 시퀀스 다이어그램](sequence/22-allowed-ips-list.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 22 연구실 접속 IP 목록 조회 (리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (AllowedIpsView)
    participant A as AllowedIpsController
    participant S as AllowedIpsService
    participant D as DataStore

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). 컨트롤러 전체가 @Roles('LEAD')라 팀원이 호출하면 403 FORBIDDEN
    U->>V: 접속 IP 화면 열기
    V->>A: GET /api/allowed-ips
    A->>S: list(현재 접속 IP)
    S->>D: 등록된 연구실 IP 전체 조회
    S->>S: 값 정규화(IPv6 매핑·루프백), 현재 접속 IP와 같으면 current 표시, id순 정렬
    S-->>V: id, ip, label, current
    V-->>U: IP 목록 표시 ("지금 접속 중" 배지)
    Note over D: 여기 등록된 IP에서는 상시 접속 가능. 재택·주말근무는 신청서에 적은 IP·시간대에서만 접속 가능하고 이 목록과 별개
```

</details>

[↑ 목차](#목차)

<a id="seq-23"></a>

### 23. 연구실 접속 IP 등록

IP 형식을 검사하고(IPv6 매핑·루프백은 정규화) 중복이면 거절합니다.

- **요구사항**: IP 관리
- **API**: `POST /api/allowed-ips`
- **권한**: 리드
- **소스**: `backend/src/allowed-ips/allowed-ips.service.ts`

![23. 연구실 접속 IP 등록 시퀀스 다이어그램](sequence/23-allowed-ips-add.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 23 연구실 접속 IP 등록 (리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (AllowedIpsView)
    participant A as AllowedIpsController
    participant S as AllowedIpsService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). 컨트롤러 전체가 @Roles('LEAD')
    U->>V: IP와 이름(선택) 입력 후 [등록]
    V->>A: POST /api/allowed-ips (ip, label)
    A->>S: add(user, 접속 IP, input)
    S->>S: IP 정규화 (공백 제거, 소문자, IPv4-mapped IPv6와 ::1 변환)
    break IP 형식이 올바르지 않으면
        S-->>V: 400 INVALID_IP
    end
    S->>D: 같은 IP가 이미 있는지 조회
    break 이미 등록되어 있으면
        S-->>V: 409 DUPLICATE_IP
    end
    S->>D: IP 저장
    S->>D: commit() 파일 저장
    S->>L: IP_ADD
    S-->>V: 200 id, ip, label, current
    V->>V: 목록 다시 불러오기
```

</details>

[↑ 목차](#목차)

<a id="seq-24"></a>

### 24. 연구실 접속 IP 이름 수정

IP 값은 그대로 두고 이름(라벨)만 바꿉니다.

- **요구사항**: IP 관리
- **API**: `PATCH /api/allowed-ips/:id`
- **권한**: 리드
- **소스**: `backend/src/allowed-ips/allowed-ips.service.ts`, `frontend/src/views/AllowedIpsView.vue`

![24. 연구실 접속 IP 이름 수정 시퀀스 다이어그램](sequence/24-allowed-ips-rename.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 24 연구실 접속 IP 이름 수정 (리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (AllowedIpsView)
    participant A as AllowedIpsController
    participant S as AllowedIpsService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). 컨트롤러 전체가 @Roles('LEAD')
    U->>V: IP 행의 이름을 눌러 수정 후 저장
    V->>A: PATCH /api/allowed-ips/:id (label)
    A->>S: rename(user, 접속 IP, id, label)
    S->>D: id로 IP 조회
    break 등록된 IP가 없으면
        S-->>V: 404 IP_NOT_FOUND
    end
    S->>D: 이름(label) 변경 (비우면 이름 없음)
    S->>D: commit() 파일 저장
    S->>L: IP_UPDATE
    S-->>V: 200 id, ip, label, current
    V->>V: 목록 다시 불러오기
```

</details>

[↑ 목차](#목차)

<a id="seq-25"></a>

### 25. 연구실 접속 IP 삭제

마지막 하나는 지울 수 없고(모두가 접속을 잃음), 지금 접속 중인 IP도 지울 수 없습니다(본인이 접속을 잃음).

- **요구사항**: IP 관리
- **API**: `DELETE /api/allowed-ips/:id`
- **권한**: 리드
- **소스**: `backend/src/allowed-ips/allowed-ips.service.ts`, `frontend/src/components/ConfirmModal.vue`

![25. 연구실 접속 IP 삭제 시퀀스 다이어그램](sequence/25-allowed-ips-remove.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 25 연구실 접속 IP 삭제 (리드 전용)
---
sequenceDiagram
    autonumber
    actor U as 리드
    participant V as 화면 (AllowedIpsView)
    participant C as 확인 창 (ConfirmModal)
    participant A as AllowedIpsController
    participant S as AllowedIpsService
    participant D as DataStore
    participant L as ActivityLog

    Note over V,A: 전역 AccessGuard를 통과한 뒤 실행 (03번). 컨트롤러 전체가 @Roles('LEAD')
    U->>V: IP 행의 [삭제] 클릭
    V->>C: 삭제 확인 창
    C->>V: 확인
    V->>A: DELETE /api/allowed-ips/:id
    A->>S: remove(user, 접속 IP, id)
    S->>D: id로 IP 조회
    break 등록된 IP가 없으면
        S-->>V: 404 IP_NOT_FOUND
    end
    break 마지막 하나라면 (모두가 연구실에서 접속하지 못하게 됨)
        S-->>V: 400 LAST_IP
    end
    break 지금 내가 접속 중인 IP라면 (스스로 접속을 잃음)
        S-->>V: 400 CURRENT_IP
    end
    S->>D: IP 삭제
    S->>D: commit() 파일 저장
    S->>L: IP_REMOVE
    S-->>V: 200 id
    V->>V: 목록 다시 불러오기
```

</details>

[↑ 목차](#목차)

## G. 공통·운영

<a id="seq-26"></a>

### 26. 데이터 저장과 이력 기록

변경은 메모리에 먼저 반영하고 `commit()`으로 파일에 저장합니다. 업무 데이터(`db.json`)는 임시 파일에 쓴 뒤 이름을 바꿔 교체하고, 이력(`activity-log.jsonl`)은 새 줄만 덧붙입니다. 이력 저장 실패는 본 업무를 막지 않습니다.

- **요구사항**: 데이터 저장 (공통)
- **API**: 모든 쓰기 기능 내부
- **권한**: —
- **소스**: `backend/src/store/data-store.ts`, `backend/src/core/activity-log.service.ts`

![26. 데이터 저장과 이력 기록 시퀀스 다이어그램](sequence/26-store-commit-log.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 26 데이터 저장과 이력 기록 (모든 쓰기 기능 공통)
---
sequenceDiagram
    autonumber
    participant S as 업무 Service
    participant T as Table (메모리 컬렉션)
    participant C as DataStore.commit
    participant Q as 저장 큐 (한 번에 하나씩)
    participant F as 데이터 파일 (backend/data)
    participant L as ActivityLogService

    S->>T: insert / update / remove — 메모리 데이터를 먼저 바꾼다
    S->>C: commit()
    C->>Q: 앞선 저장이 끝난 뒤 실행되도록 줄 세움
    opt 업무 데이터가 바뀌었다면
        Q->>F: db.json.tmp 에 전체를 기록
        Q->>F: 이름 바꾸기로 db.json 교체 (중간에 끊겨도 반쪽 파일이 남지 않음)
        Note over Q,F: 이름 바꾸기가 실패하면 직접 덮어쓰기. 쓰기 자체가 실패하면 "바뀜" 표시를 유지해 다음 저장에서 다시 시도
    end
    Q->>F: 아직 저장 안 된 새 이력 줄만 activity-log.jsonl 끝에 덧붙임 (이전 저장 실패 시에는 전체 재작성)
    C-->>S: 저장 완료
    Note over S,F: 저장이 실패하면 요청은 오류로 끝나지만 메모리의 변경은 되돌리지 않는다 (알려진 한계)
    S->>L: log(행동, 사용자, IP, 상세)
    L->>T: activityLogs.insert
    L->>C: commit() — 위와 같은 경로
    break 이력 저장이 실패하면
        L-->>S: 오류를 삼키고 서버 로그에만 기록 (이력 때문에 본 업무가 실패하지 않음)
    end
    L-->>S: 완료
```

</details>

[↑ 목차](#목차)

<a id="seq-27"></a>

### 27. 서버 상태 확인

토큰 없이 서버가 살아 있는지 확인합니다.

- **요구사항**: 운영
- **API**: `GET /api/health`
- **권한**: 누구나 (공개 API)
- **소스**: `backend/src/health.controller.ts`

![27. 서버 상태 확인 시퀀스 다이어그램](sequence/27-health.png)

<details>
<summary>Mermaid 코드 보기</summary>

```mermaid
---
title: 27 서버 상태 확인
---
sequenceDiagram
    autonumber
    actor M as 운영자 / 모니터링 도구
    participant G as AccessGuard (전역)
    participant H as HealthController

    M->>G: GET /api/health (토큰 없이)
    G->>G: @Public API라서 JWT·IP·역할 검사를 건너뜀
    G->>H: check()
    H-->>M: 200 status ok
```

</details>

[↑ 목차](#목차)

---

## 다이어그램 다시 만들기

원본은 [`sequence/`](sequence) 폴더의 `.mmd` 파일(Mermaid 코드)이고, 같은 이름의 `.png`가 렌더링 결과입니다. 코드를 고친 뒤 이미지를 다시 만들려면 [mermaid-cli](https://github.com/mermaid-js/mermaid-cli)를 사용합니다. 설정(`mermaid.config.json`)에 한글 글꼴과 간격이 들어 있습니다.

```bash
# 저장소 루트에서 한 장 만들기
npx -p @mermaid-js/mermaid-cli mmdc -i docs/sequence/01-login.mmd -o docs/sequence/01-login.png \
  -c docs/sequence/mermaid.config.json -s 2 -b white

# 전체 다시 만들기 (bash)
for f in docs/sequence/*.mmd; do
  npx -p @mermaid-js/mermaid-cli mmdc -i "$f" -o "${f%.mmd}.png" -c docs/sequence/mermaid.config.json -s 2 -b white
done
```

- 처음 실행하면 mermaid-cli가 헤드리스 브라우저(Chromium)를 내려받습니다. 이미 설치된 Chrome을 쓰려면 `-p puppeteer.json`에 `{"executablePath": "<chrome 경로>", "headless": true}`를 적어 넘기세요.
- 이미지 없이 보려면 위 `<details>` 안의 코드를 [mermaid.live](https://mermaid.live)에 붙여 넣거나, GitHub에서 이 문서를 열면 코드 블록이 그대로 그려집니다.
