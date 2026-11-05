import { Controller, Get, Query } from '@nestjs/common';
import { Matches } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { SettlementService } from './settlement.service.js';

class MonthQuery {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month는 YYYY-MM 형식이어야 합니다.' })
  month!: string;
}

@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Get()
  monthly(@CurrentUser() user: AuthUser, @Query() query: MonthQuery) {
    return this.settlement.monthly(user, query.month);
  }
}
