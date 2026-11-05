import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import { DashboardService } from './dashboard.service.js';

class IssuesQuery {
  @IsOptional()
  @IsIn(['me', 'team'])
  scope?: 'me' | 'team';
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.dashboard.myCard(user);
  }

  @Roles('LEAD')
  @Get('team')
  team() {
    return this.dashboard.teamBoard();
  }

  @Get('issues')
  issues(@CurrentUser() user: AuthUser, @Query() query: IssuesQuery) {
    const scope = query.scope ?? 'me';
    if (scope === 'team' && user.role !== 'LEAD') {
      throw new AppError(403, 'FORBIDDEN', '팀 전체 현황은 리드만 조회할 수 있습니다.');
    }
    return this.dashboard.issues(user, scope);
  }
}
