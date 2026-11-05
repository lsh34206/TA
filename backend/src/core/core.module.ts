import { Global, Module } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { AccessService } from './access.service.js';
import { ActivityLogService } from './activity-log.service.js';
import { BalanceService } from './balance.service.js';
import { HolidayService } from './holiday.service.js';
import { LoginThrottle } from './login-throttle.service.js';

const providers = [
  Clock,
  ActivityLogService,
  HolidayService,
  AccessService,
  BalanceService,
  LoginThrottle,
];

@Global()
@Module({ providers, exports: providers })
export class CoreModule {}
