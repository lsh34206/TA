import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { ClientIp, CurrentUser, Roles } from '../auth/decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ApplicationStatus, ApplicationType } from '../store/types.js';
import { ApplicationService } from './application.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CreateApplicationDto {
  @IsEnum(ApplicationType)
  type!: ApplicationType;

  @Matches(DATE_PATTERN, { message: 'targetDate는 YYYY-MM-DD 형식이어야 합니다.' })
  targetDate!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: '사유를 입력해 주세요.' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime은 HH:mm 형식이어야 합니다.' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime은 HH:mm 형식이어야 합니다.' })
  endTime?: string;
}

class ListQuery {
  @IsOptional()
  @IsIn(['me', 'team'])
  scope?: 'me' | 'team';

  @IsOptional()
  @Matches(MONTH_PATTERN, { message: 'month는 YYYY-MM 형식이어야 합니다.' })
  month?: string;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}

class DecisionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

@Controller('applications')
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applications.create(user, dto, ip);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListQuery) {
    return this.applications.list(user, query.scope ?? 'me', query.month, query.status);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applications.cancel(user, id, ip);
  }

  @Roles('LEAD')
  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.applications.decide(user, id, 'APPROVED', dto.note, ip);
  }

  @Roles('LEAD')
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.applications.decide(user, id, 'REJECTED', dto.note, ip);
  }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.applications.renderPdf(user, id, ip);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return new StreamableFile(buffer);
  }
}
