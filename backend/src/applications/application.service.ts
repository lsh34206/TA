import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { VALID_STATUSES } from '../common/application-status.js';
import { Clock } from '../common/clock.js';
import {
  isValidDateString,
  isValidTimeString,
  kstDateString,
  monthOf,
  monthRange,
  timeToSeconds,
} from '../common/kst.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { BalanceService } from '../core/balance.service.js';
import { HolidayService } from '../core/holiday.service.js';
import {
  applicationDeadline,
  isValidIp,
  normalizeIp,
  type BusinessDayChecker,
} from '../rules/application.rules.js';
import { REMOTE_PER_MONTH } from '../rules/balance.rules.js';
import { DataStore } from '../store/data-store.js';
import type { Application, ApplicationStatus, ApplicationType } from '../store/types.js';
import { ApplicationPdfService } from './application-pdf.service.js';
import { TYPE_LABEL } from './application.labels.js';

export interface CreateApplicationInput {
  type: ApplicationType;
  targetDate: string;
  reason: string;
  ip?: string;
  startTime?: string;
  endTime?: string;
}

@Injectable()
export class ApplicationService {
  constructor(
    private readonly store: DataStore,
    private readonly holidays: HolidayService,
    private readonly balances: BalanceService,
    private readonly logs: ActivityLogService,
    private readonly pdf: ApplicationPdfService,
    private readonly clock: Clock,
  ) {}

  /**
   * FN-REQ-01 신청서 제출: 기한·날짜 종류·잔여 횟수를 검사한다.
   * 검사와 저장 사이에 await가 없어 동시에 들어온 신청이 서로 끼어들 수 없다.
   */
  async create(user: AuthUser, input: CreateApplicationInput, ip: string) {
    const now = this.clock.now();
    const { type, targetDate } = input;
    if (!isValidDateString(targetDate)) {
      throw new AppError(400, 'INVALID_DATE', '대상 일자가 올바르지 않습니다.');
    }

    const checker = this.holidays.checker();
    const businessDay = checker(targetDate);
    if (type === 'WEEKEND_WORK' && businessDay) {
      throw new AppError(
        400,
        'NOT_NON_BUSINESS_DAY',
        '주말·공휴일 근무는 주말 또는 공휴일에만 신청할 수 있습니다.',
      );
    }
    if (type !== 'WEEKEND_WORK' && !businessDay) {
      throw new AppError(
        400,
        'NOT_BUSINESS_DAY',
        `${TYPE_LABEL[type]}은(는) 영업일에만 신청할 수 있습니다. 주말·공휴일은 근무 신청을 이용해 주세요.`,
      );
    }

    if (now.getTime() > applicationDeadline(targetDate, checker).getTime()) {
      throw new AppError(
        400,
        'DEADLINE_PASSED',
        '신청 기한이 지났습니다. 대상일의 전 영업일 17:00까지 신청할 수 있습니다.',
      );
    }

    const access = this.parseAccess(type, input);

    const duplicate = this.store.applications.find(
      (a) =>
        a.userId === user.id && a.targetDate === targetDate && VALID_STATUSES.includes(a.status),
    );
    if (duplicate) {
      throw new AppError(409, 'DUPLICATE', '같은 날짜에 이미 신청한 내역이 있습니다.');
    }

    let offGrantId: number | null = null;

    if (type === 'ANNUAL') {
      const balance = this.balances.forUser(user, kstDateString(now));
      if (balance.annual.remaining < 1) {
        throw new AppError(400, 'NO_BALANCE', '남은 연차가 없습니다.');
      }
    } else if (type === 'REMOTE') {
      const { start, end } = monthRange(monthOf(targetDate));
      const used = this.store.applications.filter(
        (a) =>
          a.userId === user.id &&
          a.type === 'REMOTE' &&
          VALID_STATUSES.includes(a.status) &&
          a.targetDate >= start &&
          a.targetDate <= end,
      ).length;
      if (used >= REMOTE_PER_MONTH) {
        throw new AppError(
          400,
          'NO_BALANCE',
          `${monthOf(targetDate)} 재택 횟수(월 ${REMOTE_PER_MONTH}회)를 모두 사용했습니다.`,
        );
      }
    } else if (type === 'OFF') {
      // 만료가 가장 빠른 OFF부터 사용한다
      const grant = this.store.offGrants
        .filter(
          (g) =>
            g.userId === user.id &&
            g.usedByApplicationId === null &&
            g.grantedDate <= targetDate &&
            g.expiresDate >= targetDate,
        )
        .sort((a, b) => a.expiresDate.localeCompare(b.expiresDate))[0];
      if (!grant) {
        throw new AppError(
          400,
          'NO_BALANCE',
          '해당 날짜에 사용할 수 있는 OFF가 없습니다. (지급일로부터 30일 안에 사용해야 합니다)',
        );
      }
      offGrantId = grant.id;
    }

    const created = this.store.applications.insert({
      userId: user.id,
      type,
      targetDate,
      reason: input.reason,
      ip: access?.ip ?? null,
      startTime: access?.startTime ?? null,
      endTime: access?.endTime ?? null,
      status: 'PENDING',
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: now.toISOString(),
    });
    if (offGrantId !== null) {
      this.store.offGrants.update(offGrantId, { usedByApplicationId: created.id });
    }
    await this.store.commit();

    await this.logs.log('APPLICATION_CREATE', {
      userId: user.id,
      ip,
      detail: { applicationId: created.id, type, targetDate },
    });
    return this.toDto(created, user, checker);
  }

  /** 신청 목록. scope=team은 리드 전용 */
  list(user: AuthUser, scope: 'me' | 'team', month?: string, status?: ApplicationStatus) {
    if (scope === 'team' && user.role !== 'LEAD') {
      throw new AppError(403, 'FORBIDDEN', '팀 전체 신청은 리드만 조회할 수 있습니다.');
    }
    const range = month ? monthRange(month) : null;
    const rows = this.store.applications
      .filter(
        (a) =>
          (scope === 'team' || a.userId === user.id) &&
          (!status || a.status === status) &&
          (!range || (a.targetDate >= range.start && a.targetDate <= range.end)),
      )
      .sort((a, b) => b.targetDate.localeCompare(a.targetDate) || b.id - a.id)
      .slice(0, 300);
    const checker = this.holidays.checker();
    return rows.map((row) => this.toDto(row, user, checker));
  }

  /** 본인 신청 취소 (신청 기한 전까지) */
  async cancel(user: AuthUser, id: number, ip: string) {
    const application = this.store.applications.find((a) => a.id === id && a.userId === user.id);
    if (!application) throw new AppError(404, 'NOT_FOUND', '신청 내역을 찾을 수 없습니다.');
    if (!VALID_STATUSES.includes(application.status)) {
      throw new AppError(409, 'NOT_CANCELLABLE', '이미 반려되었거나 취소된 신청입니다.');
    }

    const checker = this.holidays.checker();
    const deadline = applicationDeadline(application.targetDate, checker);
    if (this.clock.now().getTime() > deadline.getTime()) {
      throw new AppError(
        400,
        'DEADLINE_PASSED',
        '신청 기한(전 영업일 17:00)이 지나 취소할 수 없습니다.',
      );
    }

    const updated = this.invalidate(id, 'CANCELLED', {});
    await this.store.commit();
    await this.logs.log('APPLICATION_CANCEL', {
      userId: user.id,
      ip,
      detail: { applicationId: id },
    });
    return this.toDto(updated, user, checker);
  }

  /** FN-REQ-02 리드의 승인·반려 */
  async decide(
    lead: AuthUser,
    id: number,
    decision: 'APPROVED' | 'REJECTED',
    note: string | undefined,
    ip: string,
  ) {
    const application = this.store.applications.get(id);
    if (!application) throw new AppError(404, 'NOT_FOUND', '신청 내역을 찾을 수 없습니다.');
    if (application.userId === lead.id) {
      throw new AppError(403, 'SELF_DECISION', '본인 신청은 승인·반려할 수 없습니다.');
    }
    if (application.status !== 'PENDING') {
      throw new AppError(409, 'ALREADY_DECIDED', '이미 처리된 신청입니다.');
    }

    const decided = {
      decidedById: lead.id,
      decidedAt: this.clock.now().toISOString(),
      decisionNote: note || null,
    };
    const updated =
      decision === 'REJECTED'
        ? this.invalidate(id, 'REJECTED', decided)
        : this.store.applications.update(id, { status: 'APPROVED', ...decided });
    await this.store.commit();

    await this.logs.log(decision === 'APPROVED' ? 'APPLICATION_APPROVE' : 'APPLICATION_REJECT', {
      userId: lead.id,
      ip,
      detail: { applicationId: id, applicantId: application.userId, note: note ?? null },
    });
    return this.toDto(updated, lead, this.holidays.checker());
  }

  /** FN-REQ-03 신청서 PDF. 본인 또는 리드만 내려받을 수 있다 */
  async renderPdf(user: AuthUser, id: number, ip: string) {
    const application = this.store.applications.get(id);
    const applicant = application && this.store.users.get(application.userId);
    if (!application || !applicant || (application.userId !== user.id && user.role !== 'LEAD')) {
      throw new AppError(404, 'NOT_FOUND', '신청 내역을 찾을 수 없습니다.');
    }
    const decidedBy =
      application.decidedById !== null ? (this.store.users.get(application.decidedById) ?? null) : null;

    const buffer = await this.pdf.render({
      application,
      applicant,
      decidedBy,
      printedAt: this.clock.now(),
    });
    await this.logs.log('APPLICATION_PDF', { userId: user.id, ip, detail: { applicationId: id } });
    return { buffer, filename: `근태신청서_${applicant.name}_${application.targetDate}.pdf` };
  }

  /** 재택·주말 근무 신청의 IP·시간대 입력 검사. 연차·OFF는 해당 없음 */
  private parseAccess(type: ApplicationType, input: CreateApplicationInput) {
    if (type !== 'REMOTE' && type !== 'WEEKEND_WORK') return null;

    const ip = normalizeIp(input.ip);
    if (!ip || !isValidIp(ip)) {
      throw new AppError(400, 'INVALID_IP', '접속할 IP 주소를 올바르게 입력해 주세요.');
    }
    const { startTime, endTime } = input;
    if (!startTime || !endTime || !isValidTimeString(startTime) || !isValidTimeString(endTime)) {
      throw new AppError(400, 'INVALID_TIME', '근무 시간대를 HH:mm 형식으로 입력해 주세요.');
    }
    if (timeToSeconds(startTime) >= timeToSeconds(endTime)) {
      throw new AppError(400, 'INVALID_TIME', '종료 시각은 시작 시각보다 늦어야 합니다.');
    }
    return { ip, startTime, endTime };
  }

  /** 신청을 무효(반려·취소)로 바꾸고 소진한 OFF를 돌려준다 (저장은 호출한 쪽에서 commit) */
  private invalidate(
    id: number,
    status: 'REJECTED' | 'CANCELLED',
    extra: Partial<Pick<Application, 'decidedById' | 'decidedAt' | 'decisionNote'>>,
  ): Application {
    for (const grant of this.store.offGrants.filter((g) => g.usedByApplicationId === id)) {
      this.store.offGrants.update(grant.id, { usedByApplicationId: null });
    }
    return this.store.applications.update(id, { status, ...extra });
  }

  private toDto(row: Application, viewer: AuthUser, checker: BusinessDayChecker) {
    const deadline = applicationDeadline(row.targetDate, checker);
    const active = VALID_STATUSES.includes(row.status);
    return {
      id: row.id,
      userId: row.userId,
      userName: this.store.users.get(row.userId)?.name ?? '(알 수 없음)',
      type: row.type,
      targetDate: row.targetDate,
      reason: row.reason,
      ip: row.ip,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      decidedByName:
        row.decidedById !== null ? (this.store.users.get(row.decidedById)?.name ?? null) : null,
      decidedAt: row.decidedAt,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt,
      deadline: deadline.toISOString(),
      canCancel:
        row.userId === viewer.id && active && this.clock.now().getTime() <= deadline.getTime(),
      canDecide: viewer.role === 'LEAD' && row.userId !== viewer.id && row.status === 'PENDING',
    };
  }
}
