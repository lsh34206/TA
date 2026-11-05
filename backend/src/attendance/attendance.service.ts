import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { VALID_STATUSES } from '../common/application-status.js';
import { Clock } from '../common/clock.js';
import { addDays, kstDateString, kstInstant, monthRange } from '../common/kst.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { HolidayService } from '../core/holiday.service.js';
import { isWithinWindow } from '../rules/application.rules.js';
import {
  calcWorkSeconds,
  canClockIn,
  canClockOut,
  isEarlyLeave,
  isLate,
} from '../rules/attendance.rules.js';
import { offExpiresDate } from '../rules/balance.rules.js';
import { DataStore } from '../store/data-store.js';
import type { Attendance, WorkType } from '../store/types.js';
import { toAttendanceDto } from './attendance.mapper.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly store: DataStore,
    private readonly holidays: HolidayService,
    private readonly logs: ActivityLogService,
    private readonly clock: Clock,
  ) {}

  /** FN-ATT-01 · FN-ATT-04 출근 */
  async clockIn(user: AuthUser, ip: string) {
    const now = this.clock.now();
    const today = kstDateString(now);

    // FR-ATT-03: 지난 날 퇴근이 비어 있으면 먼저 퇴근 시각을 입력해야 한다
    const missing = this.findMissing(today, user.id);
    if (missing.length > 0) {
      throw new AppError(
        409,
        'MISSING_CLOCK_OUT',
        '퇴근을 등록하지 않은 날이 있습니다. 퇴근 시각을 먼저 입력해 주세요.',
        { records: missing.map((a) => toAttendanceDto(a)) },
      );
    }

    if (!canClockIn(now)) {
      throw new AppError(400, 'TOO_EARLY', '출근은 07:00부터 등록할 수 있습니다.');
    }

    if (this.findByDate(user.id, today)) {
      throw new AppError(409, 'ALREADY_CLOCKED_IN', '이미 출근을 등록했습니다.');
    }

    const applications = this.validApplications(user.id, today);
    const isBusinessDay = this.holidays.checker()(today);

    let workType: WorkType = 'OFFICE';
    if (!isBusinessDay) {
      // FR-ATT-04: 주말·공휴일은 신청한 시간대와 IP에서만 출근할 수 있다
      const requested = applications.some(
        (a) => a.type === 'WEEKEND_WORK' && isWithinWindow(a, ip, now),
      );
      if (!requested) {
        throw new AppError(
          403,
          'WEEKEND_NOT_REQUESTED',
          '주말·공휴일 근무 신청 내역(날짜·시간대·IP)과 일치하지 않아 출근할 수 없습니다.',
        );
      }
      workType = 'WEEKEND_WORK';
    } else if (applications.some((a) => a.type === 'REMOTE')) {
      workType = 'REMOTE';
    }

    const record = this.store.attendances.insert({
      userId: user.id,
      workDate: today,
      workType,
      clockIn: now.toISOString(),
      clockInIp: ip,
      clockOut: null,
      clockOutIp: null,
      clockOutManual: false,
      // 휴일 근무에는 지각 개념이 없다
      isLate: workType !== 'WEEKEND_WORK' && isLate(now),
      isEarlyLeave: false,
      workMinutes: null,
    });
    await this.store.commit();
    await this.logs.log('CLOCK_IN', {
      userId: user.id,
      ip,
      detail: { workType, isLate: record.isLate },
    });
    return toAttendanceDto(record);
  }

  /** FN-ATT-02 · FN-ATT-04 퇴근 */
  async clockOut(user: AuthUser, ip: string) {
    const now = this.clock.now();
    const today = kstDateString(now);

    const record = this.findByDate(user.id, today);
    if (!record) {
      throw new AppError(404, 'NOT_CLOCKED_IN', '오늘 출근 기록이 없습니다.');
    }
    if (record.clockOut) {
      throw new AppError(409, 'ALREADY_CLOCKED_OUT', '이미 퇴근을 등록했습니다.');
    }

    if (!canClockOut(now, this.hasHalfDayOff(user.id, today))) {
      throw new AppError(400, 'TOO_EARLY', '퇴근은 16:00부터 등록할 수 있습니다.');
    }

    if (record.workType === 'WEEKEND_WORK') {
      const requested = this.validApplications(user.id, today).some(
        (a) => a.type === 'WEEKEND_WORK' && isWithinWindow(a, ip, now),
      );
      if (!requested) {
        throw new AppError(
          403,
          'WEEKEND_NOT_REQUESTED',
          '주말·공휴일 근무 신청 내역(날짜·시간대·IP)과 일치하지 않아 퇴근할 수 없습니다.',
        );
      }
    }

    const updated = this.finalize(record, now, ip, false);
    await this.store.commit();
    await this.logs.log('CLOCK_OUT', {
      userId: user.id,
      ip,
      detail: { workMinutes: updated.workMinutes, isEarlyLeave: updated.isEarlyLeave },
    });
    return toAttendanceDto(updated);
  }

  /** FN-ATT-03 퇴근을 찍지 않은 날의 퇴근 시각 직접 입력 */
  async manualClockOut(user: AuthUser, ip: string, attendanceId: number, time: string) {
    const today = kstDateString(this.clock.now());
    const record = this.store.attendances.find(
      (a) => a.id === attendanceId && a.userId === user.id,
    );
    if (!record) throw new AppError(404, 'NOT_FOUND', '출근 기록을 찾을 수 없습니다.');
    if (record.clockOut) {
      throw new AppError(409, 'ALREADY_CLOCKED_OUT', '이미 퇴근이 기록된 날입니다.');
    }
    if (record.workDate >= today) {
      throw new AppError(400, 'NOT_PAST_DAY', '지난 날의 기록만 직접 입력할 수 있습니다.');
    }

    const clockOut = kstInstant(record.workDate, time);
    if (clockOut.getTime() <= new Date(record.clockIn).getTime()) {
      throw new AppError(400, 'INVALID_TIME', '퇴근 시각은 출근 시각보다 늦어야 합니다.');
    }

    const updated = this.finalize(record, clockOut, ip, true);
    await this.store.commit();
    await this.logs.log('CLOCK_OUT_MANUAL', {
      userId: user.id,
      ip,
      detail: { workDate: record.workDate, time, workMinutes: updated.workMinutes },
    });
    return toAttendanceDto(updated);
  }

  /** 월별 출퇴근 기록 */
  listByMonth(userId: number, month: string) {
    const { start, end } = monthRange(month);
    return this.store.attendances
      .filter((a) => a.userId === userId && a.workDate >= start && a.workDate <= end)
      .sort((a, b) => a.workDate.localeCompare(b.workDate))
      .map((a) => toAttendanceDto(a));
  }

  /** 퇴근이 비어 있는 지난 날들 (userId를 생략하면 전체) */
  findMissing(today: string, userId?: number): Attendance[] {
    return this.store.attendances
      .filter(
        (a) => (userId === undefined || a.userId === userId) && !a.clockOut && a.workDate < today,
      )
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
  }

  /** 최근 30일 안에 퇴근을 직접 입력한 건 */
  findManualEntries(today: string, userId?: number): Attendance[] {
    const since = addDays(today, -30);
    return this.store.attendances
      .filter(
        (a) =>
          (userId === undefined || a.userId === userId) &&
          a.clockOutManual &&
          a.workDate >= since,
      )
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
  }

  private findByDate(userId: number, date: string) {
    return this.store.attendances.find((a) => a.userId === userId && a.workDate === date);
  }

  private validApplications(userId: number, date: string) {
    return this.store.applications.filter(
      (a) => a.userId === userId && a.targetDate === date && VALID_STATUSES.includes(a.status),
    );
  }

  private hasHalfDayOff(userId: number, date: string): boolean {
    return this.validApplications(userId, date).some((a) => a.type === 'OFF');
  }

  /** 퇴근 시각 확정: 근무시간·조퇴 계산, 주말/공휴일 근무면 반일 OFF 지급 (저장은 호출한 쪽에서 commit) */
  private finalize(record: Attendance, clockOut: Date, ip: string, manual: boolean): Attendance {
    if (record.clockOut) {
      throw new AppError(409, 'ALREADY_CLOCKED_OUT', '이미 퇴근이 기록된 날입니다.');
    }
    const seconds = calcWorkSeconds(new Date(record.clockIn), clockOut);
    const weekendWork = record.workType === 'WEEKEND_WORK';

    const updated = this.store.attendances.update(record.id, {
      clockOut: clockOut.toISOString(),
      clockOutIp: ip,
      clockOutManual: manual,
      workMinutes: Math.floor(seconds / 60),
      // 휴일 근무에는 조퇴 개념이 없다
      isEarlyLeave:
        !weekendWork && isEarlyLeave(seconds, this.hasHalfDayOff(record.userId, record.workDate)),
    });

    if (weekendWork && !this.store.offGrants.find((g) => g.attendanceId === record.id)) {
      this.store.offGrants.insert({
        userId: record.userId,
        attendanceId: record.id,
        grantedDate: record.workDate,
        expiresDate: offExpiresDate(record.workDate),
        usedByApplicationId: null,
      });
    }
    return updated;
  }
}
