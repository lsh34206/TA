import { Injectable } from '@nestjs/common';
import { VALID_STATUSES } from '../common/application-status.js';
import { DataStore } from '../store/data-store.js';
import { computeBalances, type Balances } from '../rules/balance.rules.js';

@Injectable()
export class BalanceService {
  constructor(private readonly store: DataStore) {}

  /** 여러 사용자의 연차·재택·OFF 잔여를 한 번에 계산한다 */
  forUsers(
    users: { id: number; hireDate: string }[],
    asOf: string,
    usedUntil?: string,
  ): Map<number, Balances> {
    const applications = this.store.applications.filter((a) => VALID_STATUSES.includes(a.status));
    const grants = this.store.offGrants.all();

    const result = new Map<number, Balances>();
    for (const user of users) {
      result.set(
        user.id,
        computeBalances({
          hireDate: user.hireDate,
          asOf,
          applications: applications
            .filter((a) => a.userId === user.id)
            .map((a) => ({ type: a.type, targetDate: a.targetDate })),
          offGrants: grants
            .filter((g) => g.userId === user.id)
            .map((g) => ({
              grantedDate: g.grantedDate,
              expiresDate: g.expiresDate,
              // 사용한 OFF는 소진한 신청의 대상일로 표시한다
              usedOnDate:
                g.usedByApplicationId === null
                  ? null
                  : (this.store.applications.get(g.usedByApplicationId)?.targetDate ?? null),
            })),
          usedUntil,
        }),
      );
    }
    return result;
  }

  forUser(user: { id: number; hireDate: string }, asOf: string): Balances {
    return this.forUsers([user], asOf).get(user.id)!;
  }
}
