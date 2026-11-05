import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches } from 'class-validator';
import { ClientIp, CurrentUser } from '../auth/decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { AttendanceService } from './attendance.service.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

class ManualClockOutDto {
  @IsInt()
  attendanceId!: number;

  @Matches(TIME_PATTERN, { message: 'time은 HH:mm 형식이어야 합니다.' })
  time!: string;
}

class ListQuery {
  @Matches(MONTH_PATTERN, { message: 'month는 YYYY-MM 형식이어야 합니다.' })
  month!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('clock-in')
  clockIn(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return this.attendance.clockIn(user, ip);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return this.attendance.clockOut(user, ip);
  }

  @Post('manual-clock-out')
  manualClockOut(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Body() dto: ManualClockOutDto,
  ) {
    return this.attendance.manualClockOut(user, ip, dto.attendanceId, dto.time);
  }

  /** 월별 출퇴근 기록. 팀원은 본인 것만, 리드는 팀원 누구든 조회할 수 있다 */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListQuery) {
    const targetId = query.userId ?? user.id;
    if (targetId !== user.id && user.role !== 'LEAD') {
      throw new AppError(403, 'FORBIDDEN', '본인 기록만 조회할 수 있습니다.');
    }
    return this.attendance.listByMonth(targetId, query.month);
  }
}
