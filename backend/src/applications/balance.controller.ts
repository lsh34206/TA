import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clock } from '../common/clock.js';
import { kstDateString } from '../common/kst.js';
import { BalanceService } from '../core/balance.service.js';

@Controller('balances')
export class BalanceController {
  constructor(
    private readonly balances: BalanceService,
    private readonly clock: Clock,
  ) {}

  /** FN-BAL-01 내 연차·재택·OFF 잔여 */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.balances.forUser(user, kstDateString(this.clock.now()));
  }
}
