import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '../store/types.js';
import { clientIp } from '../common/client-ip.js';
import type { AuthedRequest } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
/** 로그인 없이 호출할 수 있는 엔드포인트 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** 지정한 역할만 호출할 수 있는 엔드포인트 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return clientIp(ctx.switchToHttp().getRequest<AuthedRequest>());
});
