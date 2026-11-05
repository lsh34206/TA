import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * TRUST_PROXY: 리버스 프록시 뒤에서 실제 접속 IP(X-Forwarded-For)를 쓰려면 지정한다.
 * 접속 IP가 곧 접근 권한이므로, 프록시가 없으면 반드시 비워 둔다(헤더 위조 방지).
 * 예) loopback, 10.0.0.0/8, 1 (홉 수)
 */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** 서버와 e2e 테스트가 함께 쓰는 앱 공통 설정 */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    exposedHeaders: ['Content-Disposition'],
  });
}
