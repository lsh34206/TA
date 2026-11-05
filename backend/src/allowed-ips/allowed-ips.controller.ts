import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { ClientIp, CurrentUser, Roles } from '../auth/decorators.js';
import { AllowedIpsService } from './allowed-ips.service.js';

class CreateAllowedIpDto {
  @IsString()
  @MaxLength(45)
  ip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;
}

class UpdateAllowedIpDto {
  @IsString()
  @MaxLength(50)
  label!: string;
}

@Roles('LEAD')
@Controller('allowed-ips')
export class AllowedIpsController {
  constructor(private readonly allowedIps: AllowedIpsService) {}

  @Get()
  list(@ClientIp() currentIp: string) {
    return this.allowedIps.list(currentIp);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Body() dto: CreateAllowedIpDto) {
    return this.allowedIps.add(user, ip, dto);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAllowedIpDto,
  ) {
    return this.allowedIps.rename(user, ip, id, dto.label);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.allowedIps.remove(user, ip, id);
  }
}
