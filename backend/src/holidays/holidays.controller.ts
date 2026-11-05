import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { ClientIp, CurrentUser, Roles } from '../auth/decorators.js';
import { HolidayAdminService } from './holiday-admin.service.js';

class YearQuery {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

class HolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date는 YYYY-MM-DD 형식이어야 합니다.' })
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidayAdminService) {}

  @Get()
  list(@Query() query: YearQuery) {
    return this.holidays.list(query.year);
  }

  @Roles('LEAD')
  @Post()
  add(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Body() dto: HolidayDto) {
    return this.holidays.add(user, ip, dto);
  }

  @Roles('LEAD')
  @Delete(':date')
  remove(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Param('date') date: string) {
    return this.holidays.remove(user, ip, date);
  }
}
