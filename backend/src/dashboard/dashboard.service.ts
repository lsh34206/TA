import { Injectable } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service.js';
import { toAttendanceDto } from '../attendance/attendance.mapper.js';
import type { AuthUser } from '../auth/auth.types.js';
import { VALID_STATUSES } from '../common/application-status.js';
import { Clock } from '../common/clock.js';
import { kstDateString } from '../common/kst.js';
import { BalanceService } from '../core/balance.service.js';
import { HolidayService } from '../core/holiday.service.js';
import { DataStore } from '../store/data-store.js';
import type { Application, ApplicationType, Attendance, WorkType } from '../store/types.js';

export type BoardStatus =
  | 'WORKING' // 출근(근무 중)
  | 'LEFT' // 퇴근
  | 'ANNUAL' // 연차
  | 'OFF' // 반일 OFF (아직 출근 전)
  | 'REMOTE' // 재택 (아직 출근 전)
  | 'WEEKEND' // 주말·공휴일 근무 예정 (아직 출근 전)
  | 'DAY_OFF' // 휴무일
  | 'ABSENT'; // 미출근

export function boardStatus(
  attendance: Attendance | undefined,
  applied: ApplicationType[],
  businessDay: boolean,
): BoardStatus {
  if (attendance) return attendance.clockOut ? 'LEFT' : 'WORKING';
  if (applied.includes('ANNUAL')) return 'ANNUAL';
  if (applied.includes('OFF')) return 'OFF';
  if (applied.includes('REMOTE')) return 'REMOTE';
  if (applied.includes('WEEKEND_WORK')) return 'WEEKEND';
  return businessDay ? 'ABSENT' : 'DAY_OFF';
}

const toApplicationSummary = (a: Application) => ({
  id: a.id,
  type: a.type,
  status: a.status,
  ip: a.ip,
  startTime: a.startTime,
  endTime: a.endTime,
});

@Injectable()
export class DashboardService {
  constructor(
    private readonly store: DataStore,
    private readonly attendance: AttendanceService,
    private readonly holidays: HolidayService,
    private readonly balances: BalanceService,
    private readonly clock: Clock,
  ) {}

  /** FN-DSH-02 내 카드: 오늘의 출퇴근, 신청 내역, 잔여 */
  myCard(user: AuthUser) {
    const now = this.clock.now();
    const today = kstDateString(now);

    const record = this.store.attendances.find((a) => a.userId === user.id && a.workDate === today);
    const applications = this.store.applications.filter(
      (a) => a.userId === user.id && a.targetDate === today && VALID_STATUSES.includes(a.status),
    );

    return {
      now: now.toISOString(),
      today,
      isBusinessDay: this.holidays.checker()(today),
      holidayName: this.holidays.nameOf(today),
      attendance: record ? toAttendanceDto(record) : null,
      applications: applications.map(toApplicationSummary),
      balances: this.balances.forUser(user, today),
    };
  }

  /** FN-DSH-01 팀 보드 (리드): 오늘 팀원별 상태 */
  teamBoard() {
    const today = kstDateString(this.clock.now());
    const businessDay = this.holidays.checker()(today);

    const records = this.store.attendances.filter((a) => a.workDate === today);
    const applications = this.store.applications.filter(
      (a) => a.targetDate === today && VALID_STATUSES.includes(a.status),
    );
    // 리드가 먼저, 같은 역할 안에서는 이름순
    const users = [...this.store.users.all()].sort(
      (a, b) => (a.role === b.role ? 0 : a.role === 'LEAD' ? -1 : 1) || a.name.localeCompare(b.name, 'ko'),
    );

    return {
      today,
      isBusinessDay: businessDay,
      members: users.map((u) => {
        const record = records.find((r) => r.userId === u.id);
        const applied = applications.filter((a) => a.userId === u.id).map((a) => a.type);
        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          status: boardStatus(record, applied, businessDay),
          workType: (record?.workType ?? null) as WorkType | null,
          applied,
          clockIn: record?.clockIn ?? null,
          clockOut: record?.clockOut ?? null,
          isLate: record?.isLate ?? false,
          isEarlyLeave: record?.isEarlyLeave ?? false,
        };
      }),
    };
  }

  /**
   * FN-DSH-03 미기록 건: 퇴근 미기록 + 최근 30일의 직접 입력 건.
   * 리드는 scope=team으로 팀 전체를 볼 수 있다.
   */
  issues(user: AuthUser, scope: 'me' | 'team') {
    const today = kstDateString(this.clock.now());
    const userId = scope === 'me' ? user.id : undefined;

    const toDto = (a: Attendance) => toAttendanceDto(a, this.store.users.get(a.userId)?.name);
    return {
      missing: this.attendance.findMissing(today, userId).map(toDto),
      manual: this.attendance.findManualEntries(today, userId).map(toDto),
    };
  }
}
