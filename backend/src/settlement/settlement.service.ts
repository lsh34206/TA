import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Clock } from '../common/clock.js';
import { kstDateString, monthRange } from '../common/kst.js';
import { BalanceService } from '../core/balance.service.js';
import { DataStore } from '../store/data-store.js';

@Injectable()
export class SettlementService {
  constructor(
    private readonly store: DataStore,
    private readonly balances: BalanceService,
    private readonly clock: Clock,
  ) {}

  /**
   * FN-STL-01 월별 정산. 팀원은 본인 행만, 리드는 팀 전체 행을 본다.
   * 잔여는 '월말(이번 달이면 오늘)' 시점 기준이다.
   */
  monthly(viewer: AuthUser, month: string) {
    const { start, end } = monthRange(month);
    const today = kstDateString(this.clock.now());
    const asOf = end < today ? end : today;

    const users = this.store.users
      .filter((u) => viewer.role === 'LEAD' || u.id === viewer.id)
      .sort(
        (a, b) =>
          (a.role === b.role ? 0 : a.role === 'LEAD' ? -1 : 1) || a.name.localeCompare(b.name, 'ko'),
      );
    const records = this.store.attendances.filter(
      (r) => r.workDate >= start && r.workDate <= end && users.some((u) => u.id === r.userId),
    );
    const balances = this.balances.forUsers(users, asOf, end);

    return {
      month,
      asOf,
      rows: users.map((u) => {
        const mine = records.filter((r) => r.userId === u.id);
        const balance = balances.get(u.id)!;
        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          workDays: mine.length,
          weekendWorkDays: mine.filter((r) => r.workType === 'WEEKEND_WORK').length,
          remoteDays: mine.filter((r) => r.workType === 'REMOTE').length,
          workMinutes: mine.reduce((sum, r) => sum + (r.workMinutes ?? 0), 0),
          lateCount: mine.filter((r) => r.isLate).length,
          earlyLeaveCount: mine.filter((r) => r.isEarlyLeave).length,
          manualCount: mine.filter((r) => r.clockOutManual).length,
          missingCount: mine.filter((r) => !r.clockOut && r.workDate < today).length,
          balances: {
            annual: balance.annual.remaining,
            remote: balance.remote.remaining,
            off: balance.off.remaining,
          },
        };
      }),
    };
  }
}
