import { Logger } from '@nestjs/common';

/** `.env.example`의 예시 값은 모두 이 접두사로 시작한다 */
const PLACEHOLDER_PREFIX = 'change-me';

export const MIN_JWT_SECRET_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 8;

/** 예시 값 그대로이거나 너무 짧은 비밀 값이면 그 사유를, 괜찮으면 null */
export function weakSecretReason(value: string | undefined, minLength: number): string | null {
  if (!value) return '값이 비어 있습니다';
  if (value.toLowerCase().startsWith(PLACEHOLDER_PREFIX)) return '예시 파일의 기본값을 그대로 쓰고 있습니다';
  if (value.length < minLength) return `${minLength}자 이상이어야 합니다`;
  return null;
}

/**
 * 약한 비밀 값을 거른다. 로컬 개발·테스트에서는 `cp .env.example .env`만으로 실행되도록 경고만 하고,
 * 운영(NODE_ENV=production)에서는 서버가 시작하지 않게 막는다.
 */
export function enforceSecret(name: string, value: string | undefined, minLength: number): void {
  const reason = weakSecretReason(value, minLength);
  if (!reason) return;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${name}을(를) 사용할 수 없습니다: ${reason}. 운영 환경(NODE_ENV=production)에서는 충분히 긴 임의 값으로 바꿔야 합니다.`,
    );
  }
  new Logger('Config').warn(
    `${name}: ${reason}. 로컬 개발에서만 허용되며, NODE_ENV=production으로 실행하면 서버가 시작하지 않습니다.`,
  );
}
