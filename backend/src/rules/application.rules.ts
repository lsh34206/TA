import { isIP } from 'node:net';
import {
  addDays,
  kstDateString,
  kstInstant,
  kstSecondsOfDay,
  timeToSeconds,
} from '../common/kst.js';

/** 신청 기한: 대상일의 전 영업일 17:00 */
export const DEADLINE_TIME = '17:00';

export type BusinessDayChecker = (date: string) => boolean;

export function previousBusinessDay(
  target: string,
  isBusinessDay: BusinessDayChecker,
): string {
  let day = addDays(target, -1);
  // 공휴일 데이터가 비어 있어도 무한 루프가 되지 않도록 상한을 둔다.
  for (let i = 0; i < 60 && !isBusinessDay(day); i++) day = addDays(day, -1);
  return day;
}

export const applicationDeadline = (
  target: string,
  isBusinessDay: BusinessDayChecker,
): Date => kstInstant(previousBusinessDay(target, isBusinessDay), DEADLINE_TIME);

export interface AccessWindow {
  targetDate: string;
  ip: string | null;
  startTime: string | null;
  endTime: string | null;
}

/** 지금이 신청한 날짜·시간대 안이고, 접속 IP가 신청한 IP와 같은가 */
export function isWithinWindow(window: AccessWindow, ip: string, now: Date): boolean {
  if (!window.ip || !window.startTime || !window.endTime) return false;
  if (window.ip !== ip) return false;
  if (kstDateString(now) !== window.targetDate) return false;
  const seconds = kstSecondsOfDay(now);
  return seconds >= timeToSeconds(window.startTime) && seconds <= timeToSeconds(window.endTime);
}

/** IPv4-mapped IPv6(::ffff:1.2.3.4)와 루프백(::1)을 비교 가능한 형태로 맞춘다 */
export function normalizeIp(raw: string | undefined | null): string {
  if (!raw) return '';
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

export const isValidIp = (value: string) => isIP(value) !== 0;
