import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enforceSecret, weakSecretReason } from './secret-check.js';

describe('weakSecretReason', () => {
  it('비어 있거나 예시 값이거나 짧으면 사유를 돌려준다', () => {
    expect(weakSecretReason(undefined, 32)).toMatch(/비어/);
    expect(weakSecretReason('', 32)).toMatch(/비어/);
    expect(weakSecretReason('change-me-to-a-long-random-string', 32)).toMatch(/기본값/);
    expect(weakSecretReason('Change-Me', 8)).toMatch(/기본값/);
    expect(weakSecretReason('short', 32)).toMatch(/32자/);
  });

  it('충분히 길고 예시 값이 아니면 통과한다', () => {
    expect(weakSecretReason('k3J9xQ2vLm8pR5tYw1ZaB7cD4eF6gH0j', 32)).toBeNull();
    expect(weakSecretReason('ta-dev-1234', 8)).toBeNull();
  });
});

describe('enforceSecret', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
    vi.restoreAllMocks();
  });

  it('운영 환경에서는 약한 값이면 예외를 던진다', () => {
    process.env.NODE_ENV = 'production';
    expect(() => enforceSecret('JWT_SECRET', 'change-me-to-a-long-random-string', 32)).toThrow(/JWT_SECRET/);
    expect(() => enforceSecret('JWT_SECRET', 'k3J9xQ2vLm8pR5tYw1ZaB7cD4eF6gH0j', 32)).not.toThrow();
  });

  it('개발·테스트 환경에서는 예외 없이 경고만 남긴다', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'development';
    expect(() => enforceSecret('JWT_SECRET', 'change-me', 32)).not.toThrow();
    process.env.NODE_ENV = 'test';
    expect(() => enforceSecret('JWT_SECRET', 'short', 32)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockClear();
    enforceSecret('JWT_SECRET', 'k3J9xQ2vLm8pR5tYw1ZaB7cD4eF6gH0j', 32);
    expect(warn).not.toHaveBeenCalled(); // 충분히 강하면 경고도 없다
  });
});
