import { hashPassword } from '../auth/password.js';
import { MIN_PASSWORD_LENGTH, enforceSecret } from '../common/secret-check.js';
import { normalizeIp } from '../rules/application.rules.js';
import type { DataStore } from './data-store.js';
import type { Role } from './types.js';

// 입사일 기준으로 연차가 매월 쌓인다: 매월 1일 / 15일 / 12일
const USERS: { loginId: string; name: string; role: Role; hireDate: string }[] = [
  { loginId: 'geuntae', name: '김근태', role: 'LEAD', hireDate: '2026-01-01' },
  { loginId: 'yeoncha', name: '연차원', role: 'MEMBER', hireDate: '2026-01-15' },
  { loginId: 'jayul', name: '임자율', role: 'MEMBER', hireDate: '2026-02-12' },
];

// 2026년 공휴일. 공식 관공서 공휴일 달력과 대조해 검증한 뒤 사용하세요.
// 이후 연도와 임시공휴일은 앱의 '공휴일' 화면(리드)에서 등록합니다.
const HOLIDAYS_2026: [string, string][] = [
  ['2026-01-01', '신정'],
  ['2026-02-16', '설날 연휴'],
  ['2026-02-17', '설날'],
  ['2026-02-18', '설날 연휴'],
  ['2026-03-01', '삼일절'],
  ['2026-03-02', '삼일절 대체공휴일'],
  ['2026-05-05', '어린이날'],
  ['2026-05-24', '부처님오신날'],
  ['2026-05-25', '부처님오신날 대체공휴일'],
  ['2026-06-03', '전국동시지방선거'],
  ['2026-06-06', '현충일'],
  ['2026-07-17', '제헌절'],
  ['2026-08-15', '광복절'],
  ['2026-08-17', '광복절 대체공휴일'],
  ['2026-09-24', '추석 연휴'],
  ['2026-09-25', '추석'],
  ['2026-09-26', '추석 연휴'],
  ['2026-10-03', '개천절'],
  ['2026-10-05', '개천절 대체공휴일'],
  ['2026-10-09', '한글날'],
  ['2026-12-25', '성탄절'],
];

/**
 * 데이터 파일이 처음 만들어질 때 한 번만 호출한다.
 * (이후 리드가 공휴일을 지우거나 연구실 IP를 바꿔도 다시 채워지지 않는다.)
 */
export async function seedInitial(
  store: DataStore,
  options: { password?: string; labIps: string[] },
): Promise<void> {
  if (!options.password) {
    throw new Error('초기 사용자를 만들려면 SEED_PASSWORD 환경 변수를 설정하세요.');
  }
  enforceSecret('SEED_PASSWORD', options.password, MIN_PASSWORD_LENGTH);

  for (const user of USERS) {
    store.users.insert({
      ...user,
      passwordHash: await hashPassword(options.password),
      createdAt: new Date().toISOString(),
    });
  }

  for (const raw of options.labIps) {
    const ip = normalizeIp(raw);
    if (ip) store.allowedIps.insert({ ip, label: '연구실' });
  }

  for (const [date, name] of HOLIDAYS_2026) store.holidays.insert({ date, name });
}
