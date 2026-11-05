# API 명세

[← README로 돌아가기](../README.md)

- 기본 주소: `http://localhost:3000/api` (개발 중에는 프론트엔드가 `/api`로 프록시)
- 형식: JSON (PDF 다운로드 제외)
- 인증: 로그인으로 받은 토큰을 `Authorization: Bearer <token>` 헤더에 담습니다(유효 12시간). `공개` 표시 외에는 모두 필요합니다.
- 모든 요청은 **접속 IP 검사**를 거칩니다. 허용되지 않은 IP면 403 `IP_NOT_ALLOWED`.
- 응답 타입의 정의는 [frontend/src/api/types.ts](../frontend/src/api/types.ts)에 있습니다.
- 권한 표기: **로그인** = 로그인한 모두, **리드** = `LEAD` 역할만.

## 오류 응답

```json
{ "statusCode": 400, "code": "DEADLINE_PASSED", "message": "신청 기한이 지났습니다. …" }
```

- `code`로 분기하고 `message`는 사용자에게 그대로 보여줄 수 있는 한국어 문장입니다. 일부 오류는 추가 필드를 함께 줍니다(`IP_NOT_ALLOWED`는 `ip`, `MISSING_CLOCK_OUT`은 `records`).
- 요청 형식 오류(DTO 검증 실패)는 Nest 기본 형식 `{ "statusCode": 400, "message": ["…"], "error": "Bad Request" }`이며 `code`가 없습니다.
- 공통: `401 UNAUTHORIZED`(토큰 없음·만료), `403 IP_NOT_ALLOWED`, `403 FORBIDDEN`(역할 부족)

## 인증

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/auth/login` | 공개 | `{ loginId, password }` → `{ token, user }`. 오류: `INVALID_CREDENTIALS`(401), `IP_NOT_ALLOWED`(403), `TOO_MANY_ATTEMPTS`(429, 같은 IP·아이디로 10분 안에 5번 틀리면 10분간 잠금. 응답에 `retryAfterSeconds`) |
| GET | `/auth/me` | 로그인 | `{ user, ip, isLabIp }` 현재 사용자와 접속 IP |

## 출퇴근

| 메서드 | 경로 | 권한 | 설명 / 주요 오류 |
| --- | --- | --- | --- |
| POST | `/attendance/clock-in` | 로그인 | 출근. `MISSING_CLOCK_OUT`(409), `TOO_EARLY`(07:00 전), `ALREADY_CLOCKED_IN`, `WEEKEND_NOT_REQUESTED`(403) |
| POST | `/attendance/clock-out` | 로그인 | 퇴근. `NOT_CLOCKED_IN`, `ALREADY_CLOCKED_OUT`, `TOO_EARLY`(16:00 전), `WEEKEND_NOT_REQUESTED` |
| POST | `/attendance/manual-clock-out` | 로그인 | 퇴근 누락일의 퇴근 시각 직접 입력. 본문 `{ attendanceId, time: "HH:mm" }`. `NOT_FOUND`, `ALREADY_CLOCKED_OUT`, `NOT_PAST_DAY`, `INVALID_TIME` |
| GET | `/attendance?month=YYYY-MM[&userId=]` | 로그인 | 월별 기록. `userId`는 리드만(다른 사람 조회) |

## 신청

| 메서드 | 경로 | 권한 | 설명 / 주요 오류 |
| --- | --- | --- | --- |
| POST | `/applications` | 로그인 | 본문 `{ type, targetDate, reason, ip?, startTime?, endTime? }`. `type`은 `ANNUAL`·`REMOTE`·`OFF`·`WEEKEND_WORK`. `ip·startTime·endTime`은 재택·휴일근무에서 필수 |
| GET | `/applications?scope=me\|team&month=&status=` | 로그인 | 목록(최대 300건). `scope=team`은 리드 |
| POST | `/applications/:id/cancel` | 로그인 | 본인 신청 취소(신청 기한 전까지). `NOT_FOUND`, `NOT_CANCELLABLE`, `DEADLINE_PASSED` |
| POST | `/applications/:id/approve` | 리드 | 승인. 본문 `{ note? }`. `SELF_DECISION`, `ALREADY_DECIDED` |
| POST | `/applications/:id/reject` | 리드 | 반려(소진한 잔여 복원). 본문 `{ note? }` |
| GET | `/applications/:id/pdf` | 본인·리드 | 신청서 PDF(`application/pdf`) |

신청 제출 오류(검사 순서대로): `INVALID_DATE` → `NOT_NON_BUSINESS_DAY`(휴일근무인데 영업일) / `NOT_BUSINESS_DAY`(그 외인데 주말·공휴일) → `DEADLINE_PASSED`(전 영업일 17:00 경과) → `INVALID_IP`·`INVALID_TIME` → `DUPLICATE`(같은 날짜에 유효한 신청이 있음) → `NO_BALANCE`(연차·재택 횟수·OFF 부족)

## 잔여 · 대시보드 · 정산 · 이력

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/balances/me` | 로그인 | 연차(적립·사용·잔여), 재택(이번 달), OFF(잔여·가장 빠른 만료일) |
| GET | `/dashboard/me` | 로그인 | 내 카드: 오늘의 출퇴근, 신청 내역, 잔여, 오늘이 영업일인지 |
| GET | `/dashboard/team` | 리드 | 팀 현황판: 팀원별 오늘 상태(근무 중·퇴근·연차·OFF·재택·미출근 등) |
| GET | `/dashboard/issues?scope=me\|team` | 로그인 | 퇴근 미기록 + 최근 30일 직접 입력 건. `scope=team`은 리드 |
| GET | `/settlement?month=YYYY-MM` | 로그인 | 월별 정산. 리드는 팀 전체, 팀원은 본인 행만 |
| GET | `/logs?limit=&before=&category=&userId=&from=&to=` | 로그인 | 이력(최신순). 리드는 전체, 팀원은 본인 것만. 아래 참고 |

**`/logs` 쿼리**

| 이름 | 설명 |
| --- | --- |
| `limit` | 1~300, 기본 100 |
| `before` | 이 id보다 오래된 것만(이어 보기) |
| `category` | `ACCESS`(접속) · `CLOCK`(출퇴근) · `APPLICATION`(신청) · `SETTINGS`(설정) |
| `userId` | 사용자(리드만 유효, 팀원은 무시되고 항상 본인) |
| `from`, `to` | `YYYY-MM-DD` KST 기준 기간(양 끝 포함). 오류: `INVALID_DATE`, `INVALID_RANGE` |

각 항목은 `{ id, action, category, userId, userName, ip, detail, createdAt }` 입니다.

## 공휴일 · 연구실 IP (리드 관리)

| 메서드 | 경로 | 권한 | 설명 / 주요 오류 |
| --- | --- | --- | --- |
| GET | `/holidays?year=YYYY` | 로그인 | 해당 연도 공휴일 목록 |
| POST | `/holidays` | 리드 | `{ date, name }` 등록(같은 날짜면 이름 갱신). 오늘 이전은 `PAST_DATE`(이미 확정된 판정이 바뀌는 것을 막음) |
| DELETE | `/holidays/:date` | 리드 | 삭제. 오늘 이전은 `PAST_DATE` |
| GET | `/allowed-ips` | 리드 | 연구실 IP 목록. 항목에 `current`(지금 접속 중인 IP인지) 포함 |
| POST | `/allowed-ips` | 리드 | `{ ip, label? }` 등록. `INVALID_IP`, `DUPLICATE_IP`(IPv6 매핑 표기도 같은 주소로 봄) |
| PATCH | `/allowed-ips/:id` | 리드 | `{ label }` 이름 수정. `IP_NOT_FOUND` |
| DELETE | `/allowed-ips/:id` | 리드 | 삭제. `LAST_IP`(마지막 하나), `CURRENT_IP`(지금 접속 중인 IP) 는 삭제 불가 |

## 기타

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/health` | 공개 | 서버 동작 확인 |
