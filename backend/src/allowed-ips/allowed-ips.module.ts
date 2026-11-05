import { Module } from '@nestjs/common';
import { AllowedIpsController } from './allowed-ips.controller.js';
import { AllowedIpsService } from './allowed-ips.service.js';

@Module({ controllers: [AllowedIpsController], providers: [AllowedIpsService] })
export class AllowedIpsModule {}
