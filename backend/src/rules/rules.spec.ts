import {
  calcWorkSeconds,
  canClockIn,
  canClockOut,
  isEarlyLeave,
  isLate,
} from './attendance.rules.js';
import { annualAccrued, computeBalances, offExpiresDate } from './balance.rules.js';
import {
  applicationDeadline,
  isWithinWindow,
  normalizeIp,
  previousBusinessDay,
} from './application.rules.js';
import { isWeekend } from '../common/kst.js';

const at = (date: string, time: string) => new Date(`${date}T${time}+09:00`);
const D = '2026-11-03';

describe('출근 / 지각', () => {
  it('10:00:00 정각까지는 정상, 넘기면 지각', () => {
    expect(isLate(at(D, '09:59:59'))).toBe(false);
    expect(isLate(at(D, '10:00:00'))).toBe(false);
    expect(isLate(at(D, '10:00:00.001'))).toBe(true);
    expect(isLate(at(D, '10:00:01'))).toBe(true);
  });

  it('출근은 07:00부터, 퇴근은 16:00부터 등록할 수 있다', () => {
    expect(canClockIn(at(D, '06:59:59'))).toBe(false);
    expect(canClockIn(at(D, '07:00:00'))).toBe(true);
    expect(canClockOut(at(D, '15:59:59'), false)).toBe(false);
    expect(canClockOut(at(D, '16:00:00'), false)).toBe(true);
  });

  it('반일 OFF 사용일은 퇴근 시각 제한이 없다', () => {
    expect(canClockOut(at(D, '13:00:00'), true)).toBe(true);
  });
});

describe('근무시간 / 조퇴', () => {
  const hours = (s: number) => s / 3600;

  it('점심(11:30~12:30)이 근무 구간에 포함되면 1시간을 뺀다', () => {
    expect(hours(calcWorkSeconds(at(D, '09:00'), at(D, '18:00')))).toBe(8);
    expect(hours(calcWorkSeconds(at(D, '09:00'), at(D, '17:00')))).toBe(7);
  });

  it('점심 구간 경계: 11:30 출근·12:30 퇴근이면 포함으로 본다', () => {
    expect(hours(calcWorkSeconds(at(D, '11:30'), at(D, '17:30')))).toBe(5);
    expect(hours(calcWorkSeconds(at(D, '08:00'), at(D, '12:30')))).toBe(3.5);
  });

  it('점심 구간 전체를 포함하지 않으면 빼지 않는다', () => {
    expect(hours(calcWorkSeconds(at(D, '11:31'), at(D, '17:31')))).toBe(6);
    expect(hours(calcWorkSeconds(at(D, '08:00'), at(D, '12:29')))).toBeCloseTo(4 + 29 / 60);
    expect(hours(calcWorkSeconds(at(D, '13:00'), at(D, '18:00')))).toBe(5);
  });

  it('퇴근이 출근보다 빠르면 0', () => {
    expect(calcWorkSeconds(at(D, '10:00'), at(D, '09:00'))).toBe(0);
  });

  it('8시간 미만이면 조퇴', () => {
    expect(isEarlyLeave(8 * 3600, false)).toBe(false);
    expect(isEarlyLeave(8 * 3600 - 1, false)).toBe(true);
  });

  it('반일 OFF 사용일은 4시간 이상이면 정상', () => {
    expect(isEarlyLeave(4 * 3600, true)).toBe(false);
    expect(isEarlyLeave(4 * 3600 - 1, true)).toBe(true);
  });
});

describe('연차 적립 (입사일 기준 매월 +1일)', () => {
  it('김근태(2026-01-01): 매월 1일에 적립', () => {
    expect(annualAccrued('2026-01-01', '2026-01-01')).toBe(0);
    expect(annualAccrued('2026-01-01', '2026-01-31')).toBe(0);
    expect(annualAccrued('2026-01-01', '2026-02-01')).toBe(1);
    expect(annualAccrued('2026-01-01', '2026-11-03')).toBe(10);
  });

  it('연차원(2026-01-15): 매월 15일에 적립', () => {
    expect(annualAccrued('2026-01-15', '2026-02-14')).toBe(0);
    expect(annualAccrued('2026-01-15', '2026-02-15')).toBe(1);
    expect(annualAccrued('2026-01-15', '2026-11-03')).toBe(9);
  });

  it('임자율(2026-02-12): 매월 12일에 적립', () => {
    expect(annualAccrued('2026-02-12', '2026-03-11')).toBe(0);
    expect(annualAccrued('2026-02-12', '2026-03-12')).toBe(1);
    expect(annualAccrued('2026-02-12', '2026-11-03')).toBe(8);
  });

  it('입사일이 말일보다 큰 달은 말일에 적립', () => {
    expect(annualAccrued('2026-01-31', '2026-02-27')).toBe(0);
    expect(annualAccrued('2026-01-31', '2026-02-28')).toBe(1);
  });

  it('입사 전 날짜는 0', () => {
    expect(annualAccrued('2026-02-12', '2026-01-01')).toBe(0);
  });
});

describe('잔여 계산', () => {
  const base = { hireDate: '2026-01-01', asOf: '2026-11-03', offGrants: [] };

  it('연차 잔여 = 적립 − 사용', () => {
    const b = computeBalances({
      ...base,
      applications: [
        { type: 'ANNUAL', targetDate: '2026-11-10' },
        { type: 'ANNUAL', targetDate: '2026-11-11' },
      ],
    });
    expect(b.annual).toEqual({ accrued: 10, used: 2, remaining: 8 });
  });

  it('재택은 해당 월 기준 2회이며 다음 달로 이월되지 않는다', () => {
    const apps = [
      { type: 'REMOTE' as const, targetDate: '2026-10-05' },
      { type: 'REMOTE' as const, targetDate: '2026-10-06' },
      { type: 'REMOTE' as const, targetDate: '2026-11-05' },
    ];
    const nov = computeBalances({ ...base, applications: apps });
    expect(nov.remote).toMatchObject({ month: '2026-11', used: 1, remaining: 1 });
    const oct = computeBalances({ ...base, asOf: '2026-10-31', applications: apps });
    expect(oct.remote).toMatchObject({ month: '2026-10', used: 2, remaining: 0 });
  });

  it('OFF는 지급일로부터 30일까지 사용할 수 있다', () => {
    expect(offExpiresDate('2026-10-10')).toBe('2026-11-09');
    const grant = { grantedDate: '2026-10-10', expiresDate: '2026-11-09', usedOnDate: null };
    const remaining = (asOf: string) =>
      computeBalances({ ...base, asOf, applications: [], offGrants: [grant] }).off.remaining;
    expect(remaining('2026-10-09')).toBe(0);
    expect(remaining('2026-10-10')).toBe(1);
    expect(remaining('2026-11-09')).toBe(1);
    expect(remaining('2026-11-10')).toBe(0);
  });

  it('사용한 OFF는 잔여에서 빠진다', () => {
    const b = computeBalances({
      ...base,
      applications: [],
      offGrants: [
        { grantedDate: '2026-10-25', expiresDate: '2026-11-24', usedOnDate: '2026-11-10' },
        { grantedDate: '2026-10-26', expiresDate: '2026-11-25', usedOnDate: null },
      ],
    });
    expect(b.off).toEqual({ remaining: 1, nextExpires: '2026-11-25' });
  });
});

describe('신청 기한 (전 영업일 17:00)', () => {
  const holidays = new Set(['2026-03-01', '2026-03-02']);
  const isBusinessDay = (d: string) => !isWeekend(d) && !holidays.has(d);

  it('월요일 대상이면 직전 금요일', () => {
    expect(previousBusinessDay('2026-11-09', isBusinessDay)).toBe('2026-11-06');
    expect(applicationDeadline('2026-11-09', isBusinessDay)).toEqual(at('2026-11-06', '17:00'));
  });

  it('주말 대상도 직전 영업일 기준', () => {
    expect(previousBusinessDay('2026-11-07', isBusinessDay)).toBe('2026-11-06');
    expect(previousBusinessDay('2026-11-08', isBusinessDay)).toBe('2026-11-06');
  });

  it('공휴일을 건너뛴다 (삼일절 + 대체공휴일)', () => {
    expect(previousBusinessDay('2026-03-03', isBusinessDay)).toBe('2026-02-27');
  });

  it('평일 대상이면 전날', () => {
    expect(previousBusinessDay('2026-11-04', isBusinessDay)).toBe('2026-11-03');
  });
});

describe('접속 허용 시간대', () => {
  const win = { targetDate: D, ip: '203.0.113.5', startTime: '09:00', endTime: '18:00' };

  it('날짜·IP·시간대가 모두 맞아야 한다', () => {
    expect(isWithinWindow(win, '203.0.113.5', at(D, '09:00:00'))).toBe(true);
    expect(isWithinWindow(win, '203.0.113.5', at(D, '18:00:00'))).toBe(true);
    expect(isWithinWindow(win, '203.0.113.5', at(D, '08:59:59'))).toBe(false);
    expect(isWithinWindow(win, '203.0.113.5', at(D, '18:00:01'))).toBe(false);
    expect(isWithinWindow(win, '203.0.113.9', at(D, '12:00'))).toBe(false);
    expect(isWithinWindow(win, '203.0.113.5', at('2026-11-04', '12:00'))).toBe(false);
  });

  it('시간대·IP 정보가 없는 신청은 허용하지 않는다', () => {
    expect(isWithinWindow({ ...win, ip: null }, '203.0.113.5', at(D, '12:00'))).toBe(false);
  });

  it('IP 표기를 정규화한다', () => {
    expect(normalizeIp('::1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIp('::FFFF:10.0.0.7')).toBe('10.0.0.7');
    expect(normalizeIp(undefined)).toBe('');
  });
});
