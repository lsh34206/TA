import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { Clock } from '../common/clock.js';
import { isValidDateString, kstDateString } from '../common/kst.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { HolidayService } from '../core/holiday.service.js';

/**
 * 공휴일 관리. 설날·추석 연휴, 대체공휴일, 임시공휴일은 해마다 달라 리드가 직접 등록한다.
 * 신청 기한(전 영업일 17:00)과 주말·공휴일 근무 판정에 쓰이므로, 이미 지난 날짜는 바꿀 수 없다.
 */
@Injectable()
export class HolidayAdminService {
  constructor(
    private readonly holidays: HolidayService,
    private readonly logs: ActivityLogService,
    private readonly clock: Clock,
  ) {}

  list(year: number) {
    return this.holidays.listByYear(year);
  }

  async add(user: AuthUser, ip: string, input: { date: string; name: string }) {
    this.assertChangeable(input.date);
    await this.holidays.upsert(input.date, input.name);
    await this.logs.log('HOLIDAY_ADD', { userId: user.id, ip, detail: { ...input } });
    return { date: input.date, name: input.name };
  }

  async remove(user: AuthUser, ip: string, date: string) {
    this.assertChangeable(date);
    await this.holidays.remove(date);
    await this.logs.log('HOLIDAY_REMOVE', { userId: user.id, ip, detail: { date } });
    return { date };
  }

  /** 오늘 이전 날짜를 바꾸면 이미 기록된 출퇴근·신청 판정이 소급해서 달라질 수 있다 */
  private assertChangeable(date: string) {
    if (!isValidDateString(date)) {
      throw new AppError(400, 'INVALID_DATE', '날짜가 올바르지 않습니다.');
    }
    if (date <= kstDateString(this.clock.now())) {
      throw new AppError(
        400,
        'PAST_DATE',
        '오늘 이전 날짜의 공휴일은 변경할 수 없습니다. 이미 기록된 출퇴근·신청 판정이 달라질 수 있습니다.',
      );
    }
  }
}
