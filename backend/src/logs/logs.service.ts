import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { addDays, isValidDateString, kstInstant } from '../common/kst.js';
import { type LogCategory, categoryOf } from '../core/log-category.js';
import { DataStore } from '../store/data-store.js';

export interface LogFilter {
  limit?: number;
  /** 이 id보다 오래된 이력만 (페이지 넘기기) */
  before?: number;
  category?: LogCategory;
  /** 사용자 (리드만 쓸 수 있다. 팀원은 항상 본인 이력만 본다) */
  userId?: number;
  /** 기간 시작일·종료일 (KST, 양 끝 포함) */
  from?: string;
  to?: string;
}

@Injectable()
export class LogsService {
  constructor(private readonly store: DataStore) {}

  /** FR-LOG-01 이력 조회. 팀원은 본인 이력만, 리드는 전체를 본다 */
  list(user: AuthUser, filter: LogFilter) {
    const { before, category, from, to } = filter;
    for (const date of [from, to]) {
      if (date !== undefined && !isValidDateString(date)) {
        throw new AppError(400, 'INVALID_DATE', '날짜가 올바르지 않습니다.');
      }
    }
    if (from && to && from > to) {
      throw new AppError(400, 'INVALID_RANGE', '시작일이 종료일보다 늦습니다.');
    }

    const isLead = user.role === 'LEAD';
    // 기록 시각은 ISO 문자열이라 문자열 비교가 곧 시간 비교다.
    const since = from ? kstInstant(from, '00:00').toISOString() : null;
    const until = to ? kstInstant(addDays(to, 1), '00:00').toISOString() : null;

    return this.store.activityLogs
      .filter(
        (r) =>
          (isLead ? filter.userId === undefined || r.userId === filter.userId : r.userId === user.id) &&
          (before === undefined || r.id < before) &&
          (category === undefined || categoryOf(r.action) === category) &&
          (since === null || r.createdAt >= since) &&
          (until === null || r.createdAt < until),
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, filter.limit ?? 100)
      .map((r) => ({
        id: r.id,
        action: r.action,
        category: categoryOf(r.action),
        userId: r.userId,
        userName: r.userId !== null ? (this.store.users.get(r.userId)?.name ?? null) : null,
        ip: r.ip,
        detail: r.detail,
        createdAt: r.createdAt,
      }));
  }
}
