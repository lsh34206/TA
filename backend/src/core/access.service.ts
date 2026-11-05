import { Injectable } from '@nestjs/common';
import { VALID_STATUSES } from '../common/application-status.js';
import { kstDateString } from '../common/kst.js';
import { isWithinWindow, normalizeIp } from '../rules/application.rules.js';
import { DataStore } from '../store/data-store.js';

/**
 * 접속 허용 판단.
 * - 연구실 IP(allowedIps): 상시 허용
 * - 그 외: 오늘 날짜의 재택·주말/공휴일 근무 신청에 적은 IP와 시간대에서만 허용
 */
@Injectable()
export class AccessService {
  constructor(private readonly store: DataStore) {}

  isLabIp(ip: string): boolean {
    return this.store.allowedIps.all().some((r) => normalizeIp(r.ip) === ip);
  }

  /** 현재 IP·시간대와 맞는 오늘의 재택/주말 근무 신청 */
  findGrant(userId: number, ip: string, now: Date) {
    const today = kstDateString(now);
    return (
      this.store.applications.find(
        (a) =>
          a.userId === userId &&
          a.targetDate === today &&
          (a.type === 'REMOTE' || a.type === 'WEEKEND_WORK') &&
          VALID_STATUSES.includes(a.status) &&
          isWithinWindow(a, ip, now),
      ) ?? null
    );
  }

  isAllowed(userId: number, ip: string, now: Date): boolean {
    return this.isLabIp(ip) || this.findGrant(userId, ip, now) !== null;
  }
}
