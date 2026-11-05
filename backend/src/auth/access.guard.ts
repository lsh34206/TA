import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../common/app-error.js';
import { Clock } from '../common/clock.js';
import { clientIp } from '../common/client-ip.js';
import { AccessService } from '../core/access.service.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { DataStore } from '../store/data-store.js';
import type { Role } from '../store/types.js';
import type { AuthedRequest } from './auth.types.js';
import { toAuthUser } from './auth.mapper.js';
import { IS_PUBLIC, ROLES } from './decorators.js';

/**
 * 모든 요청에 적용되는 전역 가드.
 * 1) 로그인(JWT) 확인  2) 접속 IP·시간대 확인(FN-SYS-01)  3) 역할 확인
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly store: DataStore,
    private readonly access: AccessService,
    private readonly logs: ActivityLogService,
    private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    let userId: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      userId = Number(payload.sub);
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }

    const user = this.store.users.get(userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');

    const ip = clientIp(req);
    if (!this.access.isAllowed(user.id, ip, this.clock.now())) {
      await this.logs.log('ACCESS_DENIED', { userId: user.id, ip, detail: { path: req.path } });
      throw new AppError(
        403,
        'IP_NOT_ALLOWED',
        '등록되지 않은 IP이거나 허용된 시간대가 아니어서 접속할 수 없습니다.',
        { ip },
      );
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.');
    }

    req.user = toAuthUser(user);
    return true;
  }
}
