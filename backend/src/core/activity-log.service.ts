import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { DataStore } from '../store/data-store.js';

export type LogAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'ACCESS_DENIED'
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'CLOCK_OUT_MANUAL'
  | 'APPLICATION_CREATE'
  | 'APPLICATION_CANCEL'
  | 'APPLICATION_APPROVE'
  | 'APPLICATION_REJECT'
  | 'APPLICATION_PDF'
  | 'HOLIDAY_ADD'
  | 'HOLIDAY_REMOVE'
  | 'IP_ADD'
  | 'IP_UPDATE'
  | 'IP_REMOVE';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    private readonly store: DataStore,
    private readonly clock: Clock,
  ) {}

  /** 이력 기록 실패가 본 업무를 막지 않도록 오류는 삼키고 로그만 남긴다. */
  async log(
    action: LogAction,
    opts: { userId?: number | null; ip?: string | null; detail?: unknown } = {},
  ): Promise<void> {
    try {
      this.store.activityLogs.insert({
        action,
        userId: opts.userId ?? null,
        ip: opts.ip ?? null,
        detail: opts.detail ?? null,
        createdAt: this.clock.now().toISOString(),
      });
      await this.store.commit();
    } catch (error) {
      this.logger.error(`이력 기록 실패 (${action})`, error as Error);
    }
  }
}
