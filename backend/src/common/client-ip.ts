import type { Request } from 'express';
import { normalizeIp } from '../rules/application.rules.js';

/**
 * 접속자 IP. 프록시 뒤에서는 main.ts의 `trust proxy` 설정(TRUST_PROXY)에 따라
 * Express가 X-Forwarded-For를 해석한 값이 `req.ip`로 들어온다.
 */
export function clientIp(req: Request): string {
  return normalizeIp(req.ip ?? req.socket.remoteAddress);
}
