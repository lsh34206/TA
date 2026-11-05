import { Module } from '@nestjs/common';
import { ApplicationPdfService } from './application-pdf.service.js';
import { ApplicationController } from './application.controller.js';
import { ApplicationService } from './application.service.js';
import { BalanceController } from './balance.controller.js';

@Module({
  controllers: [ApplicationController, BalanceController],
  providers: [ApplicationService, ApplicationPdfService],
})
export class ApplicationsModule {}
