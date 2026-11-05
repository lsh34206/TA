import { addDays, daysInMonth, monthOf } from '../common/kst.js';

/** 재택은 한 달 2회, 이월 없음 */
export const REMOTE_PER_MONTH = 2;
/** 주말·공휴일 근무로 받은 반일 OFF는 지급일로부터 30일 안에 사용 */
export const OFF_VALID_DAYS = 30;

export const offExpiresDate = (grantedDate: string) =>
  addDays(grantedDate, OFF_VALID_DAYS);

/**
 * 연차 적립 일수: 입사일 기준 매월 +1일.
 * 입사일과 같은 날짜(말일보다 큰 경우 말일)가 지날 때마다 1일씩 쌓인다.
 * 예) 2026-01-01 입사 → 매월 1일, 2026-01-15 입사 → 매월 15일.
 * 입사 당일에는 적립되지 않고, 한 달이 지난 날부터 첫 1일이 적립된다.
 */
export function annualAccrued(hireDate: string, asOf: string): number {
  const [hy, hm, hd] = hireDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);

  let months = (ay - hy) * 12 + (am - hm);
  if (months <= 0) return 0;
  if (ad < Math.min(hd, daysInMonth(ay, am))) months -= 1;
  return Math.max(0, months);
}

export type CountedType = 'ANNUAL' | 'REMOTE' | 'OFF' | 'WEEKEND_WORK';

export interface BalanceApplication {
  type: CountedType;
  targetDate: string;
}

export interface BalanceOffGrant {
  grantedDate: string;
  expiresDate: string;
  /** 이 OFF를 소진한 신청의 대상일. 미사용이면 null */
  usedOnDate: string | null;
}

export interface BalanceInput {
  hireDate: string;
  asOf: string;
  /** 유효한(반려·취소되지 않은) 신청만 */
  applications: BalanceApplication[];
  offGrants: BalanceOffGrant[];
  /** 지정하면 이 날짜까지 대상일이 도래한 신청만 사용분으로 센다 (월별 정산용) */
  usedUntil?: string;
}

export interface Balances {
  annual: { accrued: number; used: number; remaining: number };
  remote: { month: string; limit: number; used: number; remaining: number };
  off: {
    remaining: number;
    /** 가장 먼저 만료되는 OFF의 만료일 */
    nextExpires: string | null;
  };
}

export function computeBalances(input: BalanceInput): Balances {
  const { hireDate, asOf, applications, offGrants, usedUntil } = input;
  const counted = (a: BalanceApplication) => !usedUntil || a.targetDate <= usedUntil;

  const accrued = annualAccrued(hireDate, asOf);
  const annualUsed = applications.filter((a) => a.type === 'ANNUAL' && counted(a)).length;

  const month = monthOf(asOf);
  const remoteUsed = applications.filter(
    (a) => a.type === 'REMOTE' && monthOf(a.targetDate) === month && counted(a),
  ).length;

  const available = offGrants.filter(
    (g) =>
      g.grantedDate <= asOf &&
      asOf <= g.expiresDate &&
      (g.usedOnDate === null || (usedUntil !== undefined && g.usedOnDate > usedUntil)),
  );
  const nextExpires = available.map((g) => g.expiresDate).sort()[0] ?? null;

  return {
    annual: { accrued, used: annualUsed, remaining: accrued - annualUsed },
    remote: {
      month,
      limit: REMOTE_PER_MONTH,
      used: remoteUsed,
      remaining: Math.max(0, REMOTE_PER_MONTH - remoteUsed),
    },
    off: { remaining: available.length, nextExpires },
  };
}
