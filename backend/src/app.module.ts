import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AllowedIpsModule } from './allowed-ips/allowed-ips.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthController } from './health.controller.js';
import { HolidaysModule } from './holidays/holidays.module.js';
import { LogsModule } from './logs/logs.module.js';
import { SettlementModule } from './settlement/settlement.module.js';
import { StoreModule } from './store/store.module.js';

@Module({
  imports: [
    // 실행 위치와 상관없이 backend/.env를 읽는다
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(import.meta.dirname, '../.env') }),
    StoreModule,
    CoreModule,
    AuthModule,
    AttendanceModule,
    ApplicationsModule,
    DashboardModule,
    SettlementModule,
    LogsModule,
    HolidaysModule,
    AllowedIpsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
