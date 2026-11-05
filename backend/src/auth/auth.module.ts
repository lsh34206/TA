import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MIN_JWT_SECRET_LENGTH, enforceSecret } from '../common/secret-check.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        enforceSecret('JWT_SECRET', secret, MIN_JWT_SECRET_LENGTH);
        return { secret, signOptions: { expiresIn: TOKEN_TTL_SECONDS } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AccessGuard }],
})
export class AuthModule {}
