import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Clock } from '../common/clock.js';

/** 같은 IP에서 같은 아이디로 10분 안에 5번 틀리면 10분간 잠근다 */
export const MAX_FAILURES_PER_ACCOUNT = 5;
/** 한 IP에서 아이디를 바꿔 가며 시도하는 경우를 막기 위한 IP 전체 한도 */
export const MAX_FAILURES_PER_IP = 20;
export const FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const LOCK_MS = 10 * 60 * 1000;

/** 이 크기를 넘으면 기간이 지난 항목을 정리한다 (메모리가 무한정 늘지 않도록) */
const PRUNE_THRESHOLD = 5000;

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

/**
 * 로그인 무차별 대입 방지. 실패 횟수를 메모리에 세므로 서버를 재시작하면 초기화된다.
 * - 계정 잠금은 (IP, 아이디) 조합 단위다. 아이디만으로 잠그면 남이 일부러 틀려서 특정 계정을 막을 수 있다.
 * - 로그인에 성공해도 IP 전체 횟수는 지우지 않는다. 자기 계정으로 성공하면서 다른 계정을 추측하는 것을 막기 위해서다.
 */
@Injectable()
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly clock: Clock) {}

  /** 잠겨 있으면 429를 던진다. 비밀번호 검증(scrypt) 전에 호출해 CPU도 아낀다. */
  assertAllowed(ip: string, loginId: string): void {
    const now = this.clock.now().getTime();
    const lockedUntil = Math.max(
      this.entries.get(this.accountKey(ip, loginId))?.lockedUntil ?? 0,
      this.entries.get(this.ipKey(ip))?.lockedUntil ?? 0,
    );
    if (lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((lockedUntil - now) / 1000);
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        `로그인 시도가 너무 많습니다. ${minutes}분 후에 다시 시도해 주세요.`,
        { retryAfterSeconds },
      );
    }
  }

  /** 실패를 기록한다. 이번 실패로 새로 잠겼으면 true */
  recordFailure(ip: string, loginId: string): boolean {
    const now = this.clock.now().getTime();
    if (this.entries.size > PRUNE_THRESHOLD) this.prune(now);
    const account = this.count(this.accountKey(ip, loginId), now, MAX_FAILURES_PER_ACCOUNT);
    const byIp = this.count(this.ipKey(ip), now, MAX_FAILURES_PER_IP);
    return account || byIp;
  }

  /** 로그인에 성공하면 해당 (IP, 아이디)의 실패 횟수만 지운다 */
  recordSuccess(ip: string, loginId: string): void {
    this.entries.delete(this.accountKey(ip, loginId));
  }

  private count(key: string, now: number, max: number): boolean {
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStart > FAILURE_WINDOW_MS) {
      // 새 기간(또는 잠금이 끝난 뒤)이면 처음부터 센다
      entry = { failures: 0, windowStart: now, lockedUntil: 0 };
    }
    entry.failures += 1;
    const lockedNow = entry.failures >= max && entry.lockedUntil <= now;
    if (lockedNow) entry.lockedUntil = now + LOCK_MS;
    this.entries.set(key, entry);
    return lockedNow;
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > FAILURE_WINDOW_MS && entry.lockedUntil <= now) {
        this.entries.delete(key);
      }
    }
  }

  private accountKey = (ip: string, loginId: string) => `a|${ip}|${loginId.trim().toLowerCase()}`;
  private ipKey = (ip: string) => `i|${ip}`;
}
