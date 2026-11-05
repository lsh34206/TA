import { describe, expect, it } from 'vitest';
import { Clock } from '../common/clock.js';
import {
  FAILURE_WINDOW_MS,
  LOCK_MS,
  LoginThrottle,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
} from './login-throttle.service.js';

class TestClock extends Clock {
  private at = Date.parse('2026-11-05T10:00:00+09:00');
  override now() {
    return new Date(this.at);
  }
  advance(ms: number) {
    this.at += ms;
  }
}

const IP = '203.0.113.9';

function setup() {
  const clock = new TestClock();
  return { clock, throttle: new LoginThrottle(clock) };
}

describe('LoginThrottle', () => {
  it('한도 전까지는 막지 않고, 한도에 닿는 실패에서 잠근다', () => {
    const { throttle } = setup();
    for (let i = 1; i < MAX_FAILURES_PER_ACCOUNT; i++) {
      expect(throttle.recordFailure(IP, 'jayul')).toBe(false);
      expect(() => throttle.assertAllowed(IP, 'jayul')).not.toThrow();
    }
    expect(throttle.recordFailure(IP, 'jayul')).toBe(true);
    expect(() => throttle.assertAllowed(IP, 'jayul')).toThrow(/너무 많습니다/);
  });

  it('잠금 시간이 지나면 다시 시도할 수 있고, 횟수도 처음부터 센다', () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) throttle.recordFailure(IP, 'jayul');
    clock.advance(LOCK_MS - 1000);
    expect(() => throttle.assertAllowed(IP, 'jayul')).toThrow();
    clock.advance(2000);
    expect(() => throttle.assertAllowed(IP, 'jayul')).not.toThrow();
    // 잠금이 끝난 뒤 첫 실패는 1회로 다시 센다
    expect(throttle.recordFailure(IP, 'jayul')).toBe(false);
  });

  it('실패가 기간(10분)을 넘겨 흩어지면 누적되지 않는다', () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT - 1; i++) throttle.recordFailure(IP, 'jayul');
    clock.advance(FAILURE_WINDOW_MS + 1000);
    expect(throttle.recordFailure(IP, 'jayul')).toBe(false);
    expect(() => throttle.assertAllowed(IP, 'jayul')).not.toThrow();
  });

  it('다른 아이디·다른 IP는 영향을 받지 않는다 (남이 특정 계정을 막을 수 없다)', () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) throttle.recordFailure('198.51.100.1', 'jayul');
    expect(() => throttle.assertAllowed('198.51.100.1', 'jayul')).toThrow();
    expect(() => throttle.assertAllowed(IP, 'jayul')).not.toThrow();
    expect(() => throttle.assertAllowed('198.51.100.1', 'yeoncha')).not.toThrow();
  });

  it('아이디 대소문자·공백을 바꿔도 같은 계정으로 센다', () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) throttle.recordFailure(IP, i % 2 ? 'JAYUL ' : 'jayul');
    expect(() => throttle.assertAllowed(IP, ' Jayul')).toThrow();
  });

  it('아이디를 바꿔 가며 시도해도 IP 전체 한도에서 막힌다', () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) throttle.recordFailure(IP, `user${i}`);
    expect(() => throttle.assertAllowed(IP, 'brand-new-id')).toThrow(/너무 많습니다/);
  });

  it('성공하면 그 계정의 실패만 지우고 IP 전체 횟수는 유지한다', () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT - 1; i++) throttle.recordFailure(IP, 'jayul');
    throttle.recordSuccess(IP, 'jayul');
    // 계정 횟수는 처음부터: 한 번 더 틀려도 잠기지 않는다
    expect(throttle.recordFailure(IP, 'jayul')).toBe(false);

    // IP 전체 횟수는 성공해도 줄지 않는다: 성공을 끼워 넣어도 20번째 실패에서 IP가 잠긴다
    const other = setup().throttle;
    let locked = false;
    for (let i = 0; i < MAX_FAILURES_PER_IP && !locked; i++) {
      locked = other.recordFailure(IP, `guess${i}`);
      other.recordSuccess(IP, 'me');
    }
    expect(locked).toBe(true);
  });

  it('잠금 오류에 남은 시간(초)이 들어 있다', () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) throttle.recordFailure(IP, 'jayul');
    let caught: unknown;
    try {
      throttle.assertAllowed(IP, 'jayul');
    } catch (error) {
      caught = error;
    }
    const body = (caught as { getResponse(): Record<string, unknown> }).getResponse();
    expect(body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: LOCK_MS / 1000 });
  });
});
