import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { LOG_CATEGORIES, type LogCategory } from '../core/log-category.js';
import { LogsService } from './logs.service.js';

const DATE_MESSAGE = '날짜는 YYYY-MM-DD 형식이어야 합니다.';

class LogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  before?: number;

  /** 분류: 접속 / 출퇴근 / 신청 / 설정 */
  @IsOptional()
  @IsIn(LOG_CATEGORIES)
  category?: LogCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  to?: string;
}

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: LogsQuery) {
    return this.logs.list(user, query);
  }
}
