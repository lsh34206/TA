// 모든 업무 규칙은 한국 표준시(KST, UTC+9, 서머타임 없음) 기준이다.
// 날짜는 'YYYY-MM-DD' 문자열, 시각은 JS Date(절대 시각)로 다룬다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const isValidMonthString = (value: string) => MONTH_RE.test(value);
export const isValidTimeString = (value: string) => TIME_RE.test(value);

/** 절대 시각 → KST 기준 'YYYY-MM-DD' */
export function kstDateString(instant: Date): string {
  return new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 절대 시각 → KST 기준 'YYYY-MM-DD HH:mm' */
export function kstDateTimeString(instant: Date): string {
  return new Date(instant.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

/** KST 기준 자정부터 경과한 밀리초 */
export function kstMillisOfDay(instant: Date): number {
  const shifted = instant.getTime() + KST_OFFSET_MS;
  return ((shifted % DAY_MS) + DAY_MS) % DAY_MS;
}

/** KST 기준 자정부터 경과한 초(소수점 버림) */
export function kstSecondsOfDay(instant: Date): number {
  return Math.floor(kstMillisOfDay(instant) / 1000);
}

/** KST 날짜 + 'HH:mm' → 절대 시각 */
export function kstInstant(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+09:00`);
}

/** 'HH:mm' → 자정부터의 초 */
export function timeToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

const dateOnly = (date: string) => new Date(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(dateOnly(date).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 0(일) ~ 6(토) */
export function weekday(date: string): number {
  return dateOnly(date).getUTCDay();
}

export const isWeekend = (date: string) => [0, 6].includes(weekday(date));

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const monthOf = (date: string) => date.slice(0, 7);

/** 'YYYY-MM' → 해당 월의 첫날/마지막날 */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${month}-${String(daysInMonth(y, m)).padStart(2, '0')}` };
}
