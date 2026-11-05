import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../common/app-error.js';
import { Clock } from '../common/clock.js';
import { AccessService } from '../core/access.service.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { LoginThrottle } from '../core/login-throttle.service.js';
import { DataStore } from '../store/data-store.js';
import { toAuthUser } from './auth.mapper.js';
import { hashPassword, verifyPassword } from './password.js';

// 존재하지 않는 계정에도 같은 비용의 해시 검증을 수행해 계정 존재 여부가 응답 시간으로 드러나지 않게 한다.
const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

@Injectable()
export class AuthService {
  constructor(
    private readonly store: DataStore,
    private readonly jwt: JwtService,
    private readonly access: AccessService,
    private readonly logs: ActivityLogService,
    private readonly throttle: LoginThrottle,
    private readonly clock: Clock,
  ) {}

  /** FN-SYS-02 로그인 + FN-SYS-01 IP 검사. 무차별 대입은 (IP, 아이디) 단위로 시도 횟수를 제한한다 */
  async login(loginId: string, password: string, ip: string) {
    this.throttle.assertAllowed(ip, loginId);

    const user = this.store.users.find((u) => u.loginId === loginId);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid) {
      const lockedNow = this.throttle.recordFailure(ip, loginId);
      await this.logs.log('LOGIN_FAILED', { ip, detail: { loginId } });
      // 잠금은 걸리는 순간에 한 번만 기록한다 (잠긴 뒤의 시도마다 기록하면 이력이 넘친다)
      if (lockedNow) await this.logs.log('LOGIN_LOCKED', { ip, detail: { loginId } });
      throw new AppError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    this.throttle.recordSuccess(ip, loginId);

    if (!this.access.isAllowed(user.id, ip, this.clock.now())) {
      await this.logs.log('ACCESS_DENIED', { userId: user.id, ip, detail: { path: '/auth/login' } });
      throw new AppError(
        403,
        'IP_NOT_ALLOWED',
        '등록되지 않은 IP이거나 허용된 시간대가 아니어서 접속할 수 없습니다.',
        { ip },
      );
    }

    await this.logs.log('LOGIN', { userId: user.id, ip });
    const token = await this.jwt.signAsync({ sub: String(user.id) });
    return { token, user: toAuthUser(user) };
  }
}
