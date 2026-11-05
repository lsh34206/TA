import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../core/access.service.js';
import type { AuthUser } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { ClientIp, CurrentUser, Public } from './decorators.js';

class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  loginId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly access: AccessService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @ClientIp() ip: string) {
    return this.auth.login(dto.loginId, dto.password, ip);
  }

  /** 현재 로그인한 사용자와 접속 IP(연구실 IP 여부 포함) */
  @Get('me')
  me(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return { user, ip, isLabIp: this.access.isLabIp(ip) };
  }
}
