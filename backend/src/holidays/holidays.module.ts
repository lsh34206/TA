import { Module } from '@nestjs/common';
import { HolidayAdminService } from './holiday-admin.service.js';
import { HolidaysController } from './holidays.controller.js';

@Module({ controllers: [HolidaysController], providers: [HolidayAdminService] })
export class HolidaysModule {}
