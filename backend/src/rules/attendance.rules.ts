import { kstDateString, kstMillisOfDay, kstSecondsOfDay } from '../common/kst.js';

const HOUR = 3600;

/** 출근 등록은 07:00부터 */
export const CLOCK_IN_OPENS = 7 * HOUR;
/** 10:00:00을 넘기면 지각 (10:00:00 정각은 정상) */
export const LATE_AFTER_MS = 10 * HOUR * 1000;
/** 퇴근 등록은 16:00부터 (반일 OFF 사용일은 제한 없음) */
export const CLOCK_OUT_OPENS = 16 * HOUR;
/** 점심시간 11:30~12:30 */
export const LUNCH_START = 11 * HOUR + 30 * 60;
export const LUNCH_END = 12 * HOUR + 30 * 60;
export const LUNCH_SECONDS = HOUR;
/** 조퇴 기준: 근무시간 8시간 미만 (반일 OFF 사용일은 4시간 미만) */
export const FULL_DAY_SECONDS = 8 * HOUR;
export const HALF_DAY_SECONDS = 4 * HOUR;

export const isLate = (clockIn: Date) => kstMillisOfDay(clockIn) > LATE_AFTER_MS;

export const canClockIn = (now: Date) => kstSecondsOfDay(now) >= CLOCK_IN_OPENS;

export const canClockOut = (now: Date, halfDayOff: boolean) =>
  halfDayOff || kstSecondsOfDay(now) >= CLOCK_OUT_OPENS;

/**
 * 근무시간(초) = 퇴근 − 출근 − 점심 1시간.
 * 점심 11:30~12:30 전체가 근무 구간에 포함될 때만 1시간을 뺀다.
 */
export function calcWorkSeconds(clockIn: Date, clockOut: Date): number {
  const total = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000);
  if (total <= 0) return 0;

  const sameDay = kstDateString(clockIn) === kstDateString(clockOut);
  const coversLunch =
    sameDay &&
    kstSecondsOfDay(clockIn) <= LUNCH_START &&
    kstSecondsOfDay(clockOut) >= LUNCH_END;

  return Math.max(0, total - (coversLunch ? LUNCH_SECONDS : 0));
}

export const isEarlyLeave = (workSeconds: number, halfDayOff: boolean) =>
  workSeconds < (halfDayOff ? HALF_DAY_SECONDS : FULL_DAY_SECONDS);
