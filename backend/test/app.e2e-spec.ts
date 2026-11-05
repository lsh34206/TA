import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Clock } from '../src/common/clock.js';

// 테스트 전용 값이다. 실제 계정·키와 무관하다.
const PASSWORD = 'e2e-test-password';
const HOME_IP = '203.0.113.9';

/** 시각을 직접 정할 수 있는 시계 (KST) */
class FakeClock extends Clock {
  private current = new Date();
  set(kst: string) {
    this.current = new Date(`${kst}+09:00`);
  }
  override now() {
    return this.current;
  }
}

type Method = 'get' | 'post' | 'patch' | 'delete';
interface CallOptions {
  token?: string;
  body?: object;
  ip?: string;
  query?: Record<string, string>;
}

describe('근태관리 API (JSON 저장소)', () => {
  const clock = new FakeClock();
  const dirs: string[] = [];
  const apps: NestExpressApplication[] = [];
  let dataDir: string;
  let app: NestExpressApplication;

  async function createApp(dir: string) {
    process.env.DATA_DIR = dir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    const instance = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(instance);
    await instance.init();
    apps.push(instance);
    return instance;
  }

  function call(method: Method, path: string, opts: CallOptions = {}) {
    let req = request(app.getHttpServer())[method](`/api${path}`);
    if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
    if (opts.ip) req = req.set('X-Forwarded-For', opts.ip);
    if (opts.query) req = req.query(opts.query);
    if (opts.body) req = req.send(opts.body);
    return req;
  }

  async function login(loginId: string) {
    const res = await call('post', '/auth/login', { body: { loginId, password: PASSWORD } });
    expect(res.status).toBe(201);
    return res.body.token as string;
  }

  /** 상태 코드와 오류 코드를 함께 확인한다 */
  function expectError(res: request.Response, status: number, code: string) {
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  }

  let lead: string; // 김근태 (리드)
  let yeon: string; // 연차원
  let jayul: string; // 임자율

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-jwt-secret';
    process.env.SEED_PASSWORD = PASSWORD;
    process.env.LAB_IPS = '127.0.0.1';
    process.env.TRUST_PROXY = 'loopback';

    dataDir = await mkdtemp(join(tmpdir(), 'ta-e2e-'));
    dirs.push(dataDir);
    clock.set('2026-11-04T09:00:00');
    app = await createApp(dataDir);
    [lead, yeon, jayul] = [
      await login('geuntae'),
      await login('yeoncha'),
      await login('jayul'),
    ];
  });

  afterAll(async () => {
    await Promise.all(apps.map((a) => a.close().catch(() => undefined)));
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  describe('로그인과 접속 제한', () => {
    it('잘못된 비밀번호는 401', async () => {
      const res = await call('post', '/auth/login', {
        body: { loginId: 'geuntae', password: 'wrong' },
      });
      expectError(res, 401, 'INVALID_CREDENTIALS');
    });

    it('로그인하면 역할이 내려온다', async () => {
      const res = await call('get', '/auth/me', { token: lead });
      expect(res.body.user).toMatchObject({ loginId: 'geuntae', role: 'LEAD', hireDate: '2026-01-01' });
      expect(res.body.isLabIp).toBe(true);
    });

    it('등록되지 않은 IP에서는 로그인할 수 없다', async () => {
      const res = await call('post', '/auth/login', {
        body: { loginId: 'geuntae', password: PASSWORD },
        ip: HOME_IP,
      });
      expectError(res, 403, 'IP_NOT_ALLOWED');
    });

    it('토큰이 없으면 401', async () => {
      expectError(await call('get', '/dashboard/me'), 401, 'UNAUTHORIZED');
    });

    it('팀 보드는 리드만 볼 수 있다', async () => {
      expectError(await call('get', '/dashboard/team', { token: yeon }), 403, 'FORBIDDEN');
      expect((await call('get', '/dashboard/team', { token: lead })).status).toBe(200);
    });

    it('팀원은 다른 사람의 출퇴근 기록을 조회할 수 없다', async () => {
      const res = await call('get', '/attendance', {
        token: yeon,
        query: { month: '2026-11', userId: '3' },
      });
      expectError(res, 403, 'FORBIDDEN');
    });
  });

  describe('출퇴근', () => {
    it('출근은 07:00부터, 퇴근은 16:00부터', async () => {
      clock.set('2026-11-04T06:59:00');
      expectError(await call('post', '/attendance/clock-in', { token: yeon }), 400, 'TOO_EARLY');

      clock.set('2026-11-04T09:30:00');
      const inRes = await call('post', '/attendance/clock-in', { token: yeon });
      expect(inRes.status).toBe(201);
      expect(inRes.body).toMatchObject({ workType: 'OFFICE', isLate: false });
      expectError(await call('post', '/attendance/clock-in', { token: yeon }), 409, 'ALREADY_CLOCKED_IN');

      clock.set('2026-11-04T15:59:00');
      expectError(await call('post', '/attendance/clock-out', { token: yeon }), 400, 'TOO_EARLY');

      clock.set('2026-11-04T18:30:00');
      const outRes = await call('post', '/attendance/clock-out', { token: yeon });
      expect(outRes.status).toBe(201);
      // 09:30~18:30 = 9시간 − 점심 1시간
      expect(outRes.body).toMatchObject({ workMinutes: 480, isEarlyLeave: false });
      expectError(await call('post', '/attendance/clock-out', { token: yeon }), 409, 'ALREADY_CLOCKED_OUT');
    });

    it('10:00:00 정각은 정상, 근무시간 8시간 미만은 조퇴', async () => {
      clock.set('2026-11-04T10:00:00');
      const inRes = await call('post', '/attendance/clock-in', { token: jayul });
      expect(inRes.body.isLate).toBe(false);

      clock.set('2026-11-04T17:00:00');
      const outRes = await call('post', '/attendance/clock-out', { token: jayul });
      expect(outRes.body).toMatchObject({ workMinutes: 360, isEarlyLeave: true });
    });

    it('10:00:01부터는 지각', async () => {
      clock.set('2026-11-05T10:00:01');
      const inRes = await call('post', '/attendance/clock-in', { token: jayul });
      expect(inRes.body.isLate).toBe(true);
      clock.set('2026-11-05T18:30:00');
      expect((await call('post', '/attendance/clock-out', { token: jayul })).status).toBe(201);
    });
  });

  describe('신청', () => {
    let annualId: number;
    let remoteA: number;
    let remoteB: number;
    const remote = (targetDate: string) => ({
      type: 'REMOTE',
      targetDate,
      reason: '집중 작업',
      ip: HOME_IP,
      startTime: '09:00',
      endTime: '18:00',
    });

    it('연차를 신청하면 잔여가 줄고, 같은 날 중복 신청은 막는다', async () => {
      clock.set('2026-11-04T10:00:00');
      const res = await call('post', '/applications', {
        token: yeon,
        body: { type: 'ANNUAL', targetDate: '2026-11-06', reason: '개인 사유' },
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'PENDING', canCancel: true, userName: '연차원' });
      annualId = res.body.id;

      const dup = await call('post', '/applications', {
        token: yeon,
        body: { type: 'ANNUAL', targetDate: '2026-11-06', reason: '다시' },
      });
      expectError(dup, 409, 'DUPLICATE');

      // 2026-01-15 입사 → 11월 4일 기준 9일 적립, 1일 사용
      const balances = await call('get', '/balances/me', { token: yeon });
      expect(balances.body.annual).toEqual({ accrued: 9, used: 1, remaining: 8 });
    });

    it('날짜 종류를 검사한다 (연차는 영업일, 휴일 근무는 주말·공휴일)', async () => {
      const weekend = await call('post', '/applications', {
        token: yeon,
        body: { type: 'ANNUAL', targetDate: '2026-11-07', reason: '주말' },
      });
      expectError(weekend, 400, 'NOT_BUSINESS_DAY');

      const weekday = await call('post', '/applications', {
        token: yeon,
        body: { ...remote('2026-11-09'), type: 'WEEKEND_WORK' },
      });
      expectError(weekday, 400, 'NOT_NON_BUSINESS_DAY');
    });

    it('신청 기한은 대상일 전 영업일 17:00까지', async () => {
      clock.set('2026-11-04T17:00:01');
      const late = await call('post', '/applications', {
        token: yeon,
        body: { type: 'ANNUAL', targetDate: '2026-11-05', reason: '늦은 신청' },
      });
      expectError(late, 400, 'DEADLINE_PASSED');
      clock.set('2026-11-04T17:00:00');
      const onTime = await call('post', '/applications', {
        token: lead,
        body: { type: 'ANNUAL', targetDate: '2026-11-05', reason: '정각 신청' },
      });
      expect(onTime.status).toBe(201);
    });

    it('재택은 IP·시간대가 필요하고 월 2회까지, 취소·반려하면 되돌아온다', async () => {
      clock.set('2026-11-04T10:00:00');
      const noIp = await call('post', '/applications', {
        token: yeon,
        body: { ...remote('2026-11-09'), ip: undefined },
      });
      expectError(noIp, 400, 'INVALID_IP');

      const a = await call('post', '/applications', { token: yeon, body: remote('2026-11-09') });
      const b = await call('post', '/applications', { token: yeon, body: remote('2026-11-10') });
      expect([a.status, b.status]).toEqual([201, 201]);
      [remoteA, remoteB] = [a.body.id, b.body.id];

      const third = await call('post', '/applications', { token: yeon, body: remote('2026-11-12') });
      expectError(third, 400, 'NO_BALANCE');

      const cancelled = await call('post', `/applications/${remoteB}/cancel`, { token: yeon });
      expect(cancelled.body.status).toBe('CANCELLED');

      const retry = await call('post', '/applications', { token: yeon, body: remote('2026-11-12') });
      expect(retry.status).toBe(201);
      const rejected = await call('post', `/applications/${retry.body.id}/reject`, {
        token: lead,
        body: { note: '일정 조정 필요' },
      });
      expect(rejected.body).toMatchObject({ status: 'REJECTED', decisionNote: '일정 조정 필요' });

      const month = await call('get', '/balances/me', { token: yeon });
      expect(month.body.remote).toMatchObject({ month: '2026-11', used: 1, remaining: 1 });
    });

    it('OFF는 지급된 것이 없으면 신청할 수 없다', async () => {
      const res = await call('post', '/applications', {
        token: yeon,
        body: { type: 'OFF', targetDate: '2026-11-11', reason: '반일 OFF' },
      });
      expectError(res, 400, 'NO_BALANCE');
    });

    it('승인·반려는 리드만, 본인 신청은 처리할 수 없다', async () => {
      expectError(await call('post', `/applications/${annualId}/approve`, { token: yeon }), 403, 'FORBIDDEN');

      const own = await call('get', '/applications', { token: lead, query: { status: 'PENDING' } });
      const leadAppId = own.body[0].id;
      expectError(
        await call('post', `/applications/${leadAppId}/approve`, { token: lead }),
        403,
        'SELF_DECISION',
      );

      const approved = await call('post', `/applications/${annualId}/approve`, { token: lead });
      expect(approved.body).toMatchObject({ status: 'APPROVED', decidedByName: '김근태' });
      expectError(
        await call('post', `/applications/${annualId}/approve`, { token: lead }),
        409,
        'ALREADY_DECIDED',
      );
    });

    it('팀 신청 목록은 리드만 볼 수 있다', async () => {
      expectError(await call('get', '/applications', { token: yeon, query: { scope: 'team' } }), 403, 'FORBIDDEN');
      const team = await call('get', '/applications', { token: lead, query: { scope: 'team' } });
      expect(team.body.length).toBeGreaterThanOrEqual(4);
    });

    it('신청서를 PDF로 내려받는다 (본인·리드만)', async () => {
      const fetchPdf = (token: string) =>
        call('get', `/applications/${remoteA}/pdf`, { token })
          .buffer(true)
          .parse((res, done) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => done(null, Buffer.concat(chunks)));
          });

      const pdf = await fetchPdf(yeon);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.headers['content-disposition']).toContain("filename*=UTF-8''");
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

      expect((await fetchPdf(lead)).status).toBe(200);
      expect((await fetchPdf(jayul)).status).toBe(404);
    });
  });

  describe('주말 근무와 반일 OFF', () => {
    let offId: number;

    it('주말 근무는 신청한 날짜·시간대·IP에서만 출퇴근할 수 있다', async () => {
      clock.set('2026-11-05T10:00:00');
      const applied = await call('post', '/applications', {
        token: yeon,
        body: {
          type: 'WEEKEND_WORK',
          targetDate: '2026-11-07',
          reason: '실험 장비 점검',
          ip: HOME_IP,
          startTime: '10:00',
          endTime: '18:00',
        },
      });
      expect(applied.status).toBe(201);

      // 연차 사용일에는 팀 보드에 연차로 보인다
      clock.set('2026-11-06T10:00:00');
      const board = await call('get', '/dashboard/team', { token: lead });
      const row = board.body.members.find((m: { name: string }) => m.name === '연차원');
      expect(row.status).toBe('ANNUAL');

      // 토요일: 연구실 IP로는 신청한 IP와 달라 출근할 수 없다
      clock.set('2026-11-07T10:30:00');
      expectError(await call('post', '/attendance/clock-in', { token: yeon }), 403, 'WEEKEND_NOT_REQUESTED');
      // 신청하지 않은 IP는 접속 자체가 막힌다
      expectError(
        await call('get', '/dashboard/me', { token: yeon, ip: '203.0.113.77' }),
        403,
        'IP_NOT_ALLOWED',
      );
      // 신청한 IP라도 시간대 전에는 막힌다
      clock.set('2026-11-07T09:59:00');
      expectError(
        await call('get', '/dashboard/me', { token: yeon, ip: HOME_IP }),
        403,
        'IP_NOT_ALLOWED',
      );

      clock.set('2026-11-07T10:30:00');
      const inRes = await call('post', '/attendance/clock-in', { token: yeon, ip: HOME_IP });
      expect(inRes.status).toBe(201);
      expect(inRes.body).toMatchObject({ workType: 'WEEKEND_WORK', isLate: false });

      clock.set('2026-11-07T15:59:00');
      expectError(
        await call('post', '/attendance/clock-out', { token: yeon, ip: HOME_IP }),
        400,
        'TOO_EARLY',
      );
      clock.set('2026-11-07T16:30:00');
      const outRes = await call('post', '/attendance/clock-out', { token: yeon, ip: HOME_IP });
      // 10:30~16:30 = 6시간 − 점심 1시간, 휴일 근무에는 조퇴가 없다
      expect(outRes.body).toMatchObject({ workMinutes: 300, isEarlyLeave: false });
    });

    it('휴일 근무를 마치면 반일 OFF 1개가 지급되고 30일 안에 사용할 수 있다', async () => {
      const balances = await call('get', '/balances/me', { token: yeon });
      expect(balances.body.off).toEqual({ remaining: 1, nextExpires: '2026-12-07' });

      const off = await call('post', '/applications', {
        token: yeon,
        body: { type: 'OFF', targetDate: '2026-11-11', reason: '반일 OFF' },
      });
      expect(off.status).toBe(201);
      offId = off.body.id;

      const second = await call('post', '/applications', {
        token: yeon,
        body: { type: 'OFF', targetDate: '2026-11-13', reason: '하나 더' },
      });
      expectError(second, 400, 'NO_BALANCE');
    });

    it('지급일로부터 30일이 지난 날짜에는 사용할 수 없고, 취소하면 되돌아온다', async () => {
      await call('post', `/applications/${offId}/cancel`, { token: yeon });
      expect((await call('get', '/balances/me', { token: yeon })).body.off.remaining).toBe(1);

      const expired = await call('post', '/applications', {
        token: yeon,
        body: { type: 'OFF', targetDate: '2026-12-08', reason: '만료 후' },
      });
      expectError(expired, 400, 'NO_BALANCE');

      const again = await call('post', '/applications', {
        token: yeon,
        body: { type: 'OFF', targetDate: '2026-11-11', reason: '반일 OFF' },
      });
      expect(again.status).toBe(201);
    });
  });

  describe('재택일 출근과 퇴근 미기록', () => {
    it('재택 신청일에 출근하면 재택으로 기록된다', async () => {
      clock.set('2026-11-09T09:00:00');
      const inRes = await call('post', '/attendance/clock-in', { token: yeon });
      expect(inRes.body.workType).toBe('REMOTE');
      clock.set('2026-11-09T18:30:00');
      expect((await call('post', '/attendance/clock-out', { token: yeon })).status).toBe(201);
    });

    it('퇴근을 안 찍으면 다음 출근 때 직접 입력해야 한다', async () => {
      clock.set('2026-11-09T09:00:00');
      expect((await call('post', '/attendance/clock-in', { token: jayul })).status).toBe(201);

      clock.set('2026-11-10T09:00:00');
      const blocked = await call('post', '/attendance/clock-in', { token: jayul });
      expectError(blocked, 409, 'MISSING_CLOCK_OUT');
      expect(blocked.body.records).toHaveLength(1);
      expect(blocked.body.records[0].workDate).toBe('2026-11-09');
      const missingId = blocked.body.records[0].id as number;

      // 다른 사람의 기록은 입력할 수 없고, 출근보다 이른 시각도 안 된다
      expectError(
        await call('post', '/attendance/manual-clock-out', {
          token: yeon,
          body: { attendanceId: missingId, time: '18:00' },
        }),
        404,
        'NOT_FOUND',
      );
      expectError(
        await call('post', '/attendance/manual-clock-out', {
          token: jayul,
          body: { attendanceId: missingId, time: '08:00' },
        }),
        400,
        'INVALID_TIME',
      );

      const manual = await call('post', '/attendance/manual-clock-out', {
        token: jayul,
        body: { attendanceId: missingId, time: '18:00' },
      });
      expect(manual.status).toBe(201);
      expect(manual.body).toMatchObject({ clockOutManual: true, workMinutes: 480, isEarlyLeave: false });

      const issues = await call('get', '/dashboard/issues', { token: jayul });
      expect(issues.body.missing).toHaveLength(0);
      expect(issues.body.manual).toHaveLength(1);

      expect((await call('post', '/attendance/clock-in', { token: jayul })).status).toBe(201);
      clock.set('2026-11-10T18:00:00');
      expect((await call('post', '/attendance/clock-out', { token: jayul })).status).toBe(201);
    });
  });

  describe('반일 OFF 사용일', () => {
    it('퇴근 16:00 제한이 없고 근무 4시간이면 정상이다', async () => {
      clock.set('2026-11-11T09:00:00');
      expect((await call('post', '/attendance/clock-in', { token: yeon })).status).toBe(201);

      clock.set('2026-11-11T11:00:00');
      const board = await call('get', '/dashboard/team', { token: lead });
      const row = board.body.members.find((m: { name: string }) => m.name === '연차원');
      expect(row).toMatchObject({ status: 'WORKING', applied: ['OFF'] });

      clock.set('2026-11-11T14:00:00');
      const outRes = await call('post', '/attendance/clock-out', { token: yeon });
      // 09:00~14:00 = 5시간 − 점심 1시간 = 4시간
      expect(outRes.body).toMatchObject({ workMinutes: 240, isEarlyLeave: false });
    });
  });

  describe('공휴일', () => {
    it('리드만 등록·삭제할 수 있고, 지난 날짜는 바꿀 수 없다', async () => {
      clock.set('2026-11-12T10:00:00');
      const body = { date: '2026-11-20', name: '임시공휴일' };

      expectError(await call('post', '/holidays', { token: yeon, body }), 403, 'FORBIDDEN');
      expectError(
        await call('post', '/holidays', { token: lead, body: { date: '2026-11-12', name: '오늘' } }),
        400,
        'PAST_DATE',
      );
      expect((await call('post', '/holidays', { token: lead, body })).status).toBe(201);

      const annual = { type: 'ANNUAL', targetDate: '2026-11-20', reason: '공휴일 연차' };
      expectError(await call('post', '/applications', { token: yeon, body: annual }), 400, 'NOT_BUSINESS_DAY');
      const list = await call('get', '/holidays', { token: yeon, query: { year: '2026' } });
      expect(list.body.map((h: { date: string }) => h.date)).toContain('2026-11-20');

      expect((await call('delete', '/holidays/2026-11-20', { token: lead })).status).toBe(200);
      expect((await call('post', '/applications', { token: yeon, body: annual })).status).toBe(201);
    });
  });

  describe('연구실 IP 관리', () => {
    const NEW_IP = '198.51.100.7';

    it('리드만 조회·등록할 수 있다', async () => {
      expectError(await call('get', '/allowed-ips', { token: yeon }), 403, 'FORBIDDEN');
      expectError(
        await call('post', '/allowed-ips', { token: yeon, body: { ip: NEW_IP } }),
        403,
        'FORBIDDEN',
      );

      const list = await call('get', '/allowed-ips', { token: lead });
      expect(list.body).toEqual([{ id: 1, ip: '127.0.0.1', label: '연구실', current: true }]);
    });

    it('IP 형식과 중복을 검사한다 (IPv6 매핑 표기도 같은 주소로 본다)', async () => {
      const post = (ip: string) => call('post', '/allowed-ips', { token: lead, body: { ip } });
      expectError(await post('not-an-ip'), 400, 'INVALID_IP');
      expectError(await post('999.1.1.1'), 400, 'INVALID_IP');
      expectError(await post('127.0.0.1'), 409, 'DUPLICATE_IP');
      expectError(await post('::ffff:127.0.0.1'), 409, 'DUPLICATE_IP');
    });

    it('등록하면 그 IP에서 팀원도 접속할 수 있고, 삭제하면 다시 막힌다', async () => {
      expectError(await call('get', '/dashboard/me', { token: yeon, ip: NEW_IP }), 403, 'IP_NOT_ALLOWED');

      const added = await call('post', '/allowed-ips', {
        token: lead,
        body: { ip: ` ${NEW_IP} `, label: ' 별관 ' },
      });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ ip: NEW_IP, label: '별관', current: false });
      expect((await call('get', '/dashboard/me', { token: yeon, ip: NEW_IP })).status).toBe(200);

      const renamed = await call('patch', `/allowed-ips/${added.body.id}`, {
        token: lead,
        body: { label: '본관 2층' },
      });
      expect(renamed.body).toMatchObject({ ip: NEW_IP, label: '본관 2층' });
      expectError(
        await call('patch', '/allowed-ips/9999', { token: lead, body: { label: 'x' } }),
        404,
        'IP_NOT_FOUND',
      );

      expect((await call('delete', `/allowed-ips/${added.body.id}`, { token: lead })).status).toBe(200);
      expectError(await call('get', '/dashboard/me', { token: yeon, ip: NEW_IP }), 403, 'IP_NOT_ALLOWED');
    });

    it('지금 접속 중인 IP와 마지막 하나는 지울 수 없다', async () => {
      const added = await call('post', '/allowed-ips', { token: lead, body: { ip: NEW_IP } });
      const list = await call('get', '/allowed-ips', { token: lead });
      expect(list.body.map((r: { ip: string; current: boolean }) => [r.ip, r.current])).toEqual([
        ['127.0.0.1', true],
        [NEW_IP, false],
      ]);

      expectError(await call('delete', '/allowed-ips/1', { token: lead }), 400, 'CURRENT_IP');
      await call('delete', `/allowed-ips/${added.body.id}`, { token: lead });
      expectError(await call('delete', '/allowed-ips/1', { token: lead }), 400, 'LAST_IP');
    });
  });

  describe('정산과 이력', () => {
    it('월별 정산 (리드는 전체, 팀원은 본인)', async () => {
      const res = await call('get', '/settlement', { token: lead, query: { month: '2026-11' } });
      const byName = Object.fromEntries(
        res.body.rows.map((r: { name: string }) => [r.name, r]),
      ) as Record<string, any>;

      // 11/4 출근(480분), 11/7 휴일 근무(300분), 11/9 재택(09:00~18:30 = 510분), 11/11 OFF 사용일(240분)
      expect(byName['연차원']).toMatchObject({
        workDays: 4,
        weekendWorkDays: 1,
        remoteDays: 1,
        workMinutes: 1530,
        lateCount: 0,
        earlyLeaveCount: 0,
      });
      // 조퇴: 11/4(6시간), 11/5(7시간 29분) · 지각: 11/5 · 직접 입력: 11/9
      expect(byName['임자율']).toMatchObject({
        workDays: 4,
        lateCount: 1,
        earlyLeaveCount: 2,
        manualCount: 1,
        missingCount: 0,
      });
      expect(byName['김근태'].workDays).toBe(0);
      // 월말 기준 잔여: 연차 적립 9일 중 2건 사용(11/6, 11/20), 재택 11/9 1회, OFF 사용 완료
      expect(byName['연차원'].balances).toEqual({ annual: 7, remote: 1, off: 0 });

      const mine = await call('get', '/settlement', { token: jayul, query: { month: '2026-11' } });
      expect(mine.body.rows).toHaveLength(1);
      expect(mine.body.rows[0].name).toBe('임자율');
    });

    it('모든 인터랙션이 이력으로 남는다', async () => {
      const all = await call('get', '/logs', { token: lead, query: { limit: '300' } });
      const actions = new Set(all.body.map((l: { action: string }) => l.action));
      for (const action of [
        'LOGIN',
        'LOGIN_FAILED',
        'ACCESS_DENIED',
        'CLOCK_IN',
        'CLOCK_OUT',
        'CLOCK_OUT_MANUAL',
        'APPLICATION_CREATE',
        'APPLICATION_CANCEL',
        'APPLICATION_APPROVE',
        'APPLICATION_REJECT',
        'APPLICATION_PDF',
        'HOLIDAY_ADD',
        'HOLIDAY_REMOVE',
        'IP_ADD',
        'IP_UPDATE',
        'IP_REMOVE',
      ]) {
        expect(actions).toContain(action);
      }

      const mine = await call('get', '/logs', { token: jayul });
      expect(mine.body.length).toBeGreaterThan(0);
      expect(mine.body.every((l: { userName: string }) => l.userName === '임자율')).toBe(true);

      const page = await call('get', '/logs', { token: lead, query: { limit: '5' } });
      const older = await call('get', '/logs', {
        token: lead,
        query: { limit: '5', before: String(page.body[4].id) },
      });
      expect(older.body[0].id).toBeLessThan(page.body[4].id);
    });

    it('분류·사용자·기간으로 걸러 볼 수 있다', async () => {
      const logs = (token: string, query: Record<string, string>) =>
        call('get', '/logs', { token, query: { limit: '300', ...query } });
      const categoryOf = (body: { category: string }[]) => new Set(body.map((l) => l.category));

      // 분류 — 모든 이력에 분류가 붙고, 분류로 걸러 보면 그 분류만 나온다
      const all = await logs(lead, {});
      expect(all.body.every((l: { category: string | null }) => l.category !== null)).toBe(true);
      expect(categoryOf(all.body)).toEqual(new Set(['ACCESS', 'CLOCK', 'APPLICATION', 'SETTINGS']));

      const clockLogs = await logs(lead, { category: 'CLOCK' });
      expect(clockLogs.body.length).toBeGreaterThan(0);
      expect(categoryOf(clockLogs.body)).toEqual(new Set(['CLOCK']));
      const settings = await logs(lead, { category: 'SETTINGS' });
      expect(new Set(settings.body.map((l: { action: string }) => l.action))).toEqual(
        new Set(['HOLIDAY_ADD', 'HOLIDAY_REMOVE', 'IP_ADD', 'IP_UPDATE', 'IP_REMOVE']),
      );
      expect((await logs(lead, { category: 'WRONG' })).status).toBe(400);

      // 사용자 — 리드는 사람별로, 팀원은 userId를 넘겨도 본인 것만 본다
      const jayulLogs = await logs(lead, { userId: '3' });
      expect(jayulLogs.body.length).toBeGreaterThan(0);
      expect(jayulLogs.body.every((l: { userName: string }) => l.userName === '임자율')).toBe(true);
      const sneaky = await logs(yeon, { userId: '3' });
      expect(sneaky.body.every((l: { userName: string }) => l.userName === '연차원')).toBe(true);

      // 기간 — KST 날짜 기준으로 시작일·종료일을 모두 포함한다
      const day = await logs(lead, { from: '2026-11-12', to: '2026-11-12' });
      expect(day.body.length).toBeGreaterThan(0);
      const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
      expect(day.body.every((l: { createdAt: string }) => kstDay(l.createdAt) === '2026-11-12')).toBe(true);
      expect((await logs(lead, { from: '2030-01-01' })).body).toEqual([]);
      expect((await logs(lead, { from: '2026-11-13', to: '2026-11-12' })).status).toBe(400);
      expect((await logs(lead, { from: '2026-02-30' })).status).toBe(400);

      // 필터를 걸어도 이어 보기(before)가 동작한다
      const first = await logs(lead, { category: 'CLOCK', limit: '3' });
      const next = await logs(lead, { category: 'CLOCK', limit: '3', before: String(first.body[2].id) });
      expect(next.body[0].id).toBeLessThan(first.body[2].id);
      expect(categoryOf(next.body)).toEqual(new Set(['CLOCK']));
    });
  });

  describe('JSON 파일 저장', () => {
    it('데이터 파일이 만들어지고, 서버를 다시 시작해도 유지된다', async () => {
      const db = JSON.parse(await readFile(join(dataDir, 'db.json'), 'utf8'));
      expect(Object.keys(db).sort()).toEqual(
        ['allowedIps', 'applications', 'attendances', 'holidays', 'offGrants', 'users'],
      );
      expect(db.users).toHaveLength(3);
      expect(db.users[0].passwordHash).toMatch(/^scrypt\$/);
      expect(db.attendances.length).toBeGreaterThanOrEqual(8);
      // 이력은 한 줄에 한 건(JSON Lines)
      const logLines = (await readFile(join(dataDir, 'activity-log.jsonl'), 'utf8')).trim().split('\n');
      expect(logLines.length).toBeGreaterThan(30);
      expect(JSON.parse(logLines[0])).toMatchObject({ id: 1, action: expect.any(String) });

      // 사람이 손으로 id 없는 공휴일을 추가해도 읽어 들이고 id를 채운다
      db.holidays.push({ date: '2026-11-25', name: '손으로 추가' });
      await writeFile(join(dataDir, 'db.json'), JSON.stringify(db, null, 2));

      await app.close();
      app = await createApp(dataDir);
      lead = await login('geuntae');

      const settlement = await call('get', '/settlement', { token: lead, query: { month: '2026-11' } });
      const jay = settlement.body.rows.find((r: { name: string }) => r.name === '임자율');
      expect(jay).toMatchObject({ workDays: 4, lateCount: 1, manualCount: 1 });

      const holidays = await call('get', '/holidays', { token: lead, query: { year: '2026' } });
      expect(holidays.body.map((h: { date: string }) => h.date)).toContain('2026-11-25');
      const saved = JSON.parse(await readFile(join(dataDir, 'db.json'), 'utf8'));
      const added = saved.holidays.find((h: { date: string }) => h.date === '2026-11-25');
      expect(Number.isInteger(added.id)).toBe(true);
    });

    it('깨진 데이터 파일은 덮어쓰지 않고 시작을 멈춘다', async () => {
      const broken = await mkdtemp(join(tmpdir(), 'ta-e2e-broken-'));
      dirs.push(broken);
      await writeFile(join(broken, 'db.json'), '{ 깨진 json');

      await expect(createApp(broken)).rejects.toThrow('JSON 형식 오류');
      expect(await readFile(join(broken, 'db.json'), 'utf8')).toBe('{ 깨진 json');
    });
  });

  describe('이력 파일 (JSON Lines)', () => {
    const post = (inst: NestExpressApplication, path: string, body: object) =>
      request(inst.getHttpServer()).post(`/api${path}`).send(body);
    const loginAs = (inst: NestExpressApplication, loginId: string) =>
      post(inst, '/auth/login', { loginId, password: PASSWORD });

    /** 로그인 2번(이력 2줄)이 쌓인 새 데이터 폴더 */
    async function dirWithLogs() {
      const dir = await mkdtemp(join(tmpdir(), 'ta-e2e-logs-'));
      dirs.push(dir);
      const inst = await createApp(dir);
      await loginAs(inst, 'geuntae');
      await loginAs(inst, 'yeoncha');
      await inst.close();
      return dir;
    }

    it('새 이력은 파일 끝에 한 줄씩 덧붙고, 앞부분은 그대로다', async () => {
      const dir = await dirWithLogs();
      const file = join(dir, 'activity-log.jsonl');
      const before = await readFile(file, 'utf8');
      expect(before.endsWith('\n')).toBe(true);
      expect(before.trim().split('\n')).toHaveLength(2);

      const inst = await createApp(dir); // 재시작해도 이어서 쓴다
      expect((await loginAs(inst, 'jayul')).status).toBe(201);
      await inst.close();

      const after = await readFile(file, 'utf8');
      expect(after.startsWith(before)).toBe(true); // 기존 줄은 다시 쓰지 않는다
      const added = after.slice(before.length).trim().split('\n');
      expect(added).toHaveLength(1);
      expect(JSON.parse(added[0])).toMatchObject({ id: 3, action: 'LOGIN' });
    });

    it('쓰다 끊겨 마지막 줄만 잘렸으면 버리고 시작하고, 중간 줄이 깨졌으면 멈춘다', async () => {
      const dir = await dirWithLogs();
      const file = join(dir, 'activity-log.jsonl');
      const original = await readFile(file, 'utf8');

      await writeFile(file, `${original}{"id":3,"action":"LOG`);
      const inst = await createApp(dir);
      await inst.close();
      expect(await readFile(file, 'utf8')).toBe(original); // 잘린 줄은 버리고 파일을 깨끗하게 다시 씀

      const [first, second] = original.trim().split('\n');
      const corrupted = `${first}\n{깨진 줄\n${second}\n`;
      await writeFile(file, corrupted);
      await expect(createApp(dir)).rejects.toThrow('2번째 줄');
      expect(await readFile(file, 'utf8')).toBe(corrupted); // 데이터를 잃지 않도록 덮어쓰지 않는다
    });

    it('예전 형식(activity-log.json)은 JSON Lines로 옮기고 원본은 .bak으로 보관한다', async () => {
      const dir = await dirWithLogs();
      const file = join(dir, 'activity-log.jsonl');
      const legacy = (await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      await rm(file);
      await writeFile(join(dir, 'activity-log.json'), JSON.stringify(legacy, null, 2));

      const inst = await createApp(dir);
      const token = (await loginAs(inst, 'geuntae')).body.token as string;
      const logs = await request(inst.getHttpServer())
        .get('/api/logs')
        .set('Authorization', `Bearer ${token}`);
      expect(logs.body.map((l: { id: number }) => l.id)).toEqual([3, 2, 1]); // 옮긴 2건 + 방금 로그인
      await inst.close();

      await expect(readFile(join(dir, 'activity-log.json'), 'utf8')).rejects.toThrow();
      expect(JSON.parse(await readFile(join(dir, 'activity-log.json.bak'), 'utf8'))).toHaveLength(2);
      expect((await readFile(file, 'utf8')).trim().split('\n')).toHaveLength(3);
    });
  });

  describe('로그인 시도 제한', () => {
    const attempt = (password: string, loginId = 'jayul', ip?: string) =>
      call('post', '/auth/login', { body: { loginId, password }, ip });

    it('같은 IP·아이디로 5번 틀리면 잠기고, 맞는 비밀번호도 잠금이 풀릴 때까지 거절한다', async () => {
      clock.set('2026-12-01T10:00:00');
      for (let i = 0; i < 5; i++) expectError(await attempt('wrong-password'), 401, 'INVALID_CREDENTIALS');

      const locked = await attempt(PASSWORD);
      expectError(locked, 429, 'TOO_MANY_ATTEMPTS');
      expect(locked.body.retryAfterSeconds).toBe(600);

      // 다른 아이디나 다른 IP는 영향을 받지 않는다 (남이 틀려서 내 계정을 막을 수 없다)
      expect((await attempt(PASSWORD, 'yeoncha')).status).toBe(201);
      expectError(await attempt(PASSWORD, 'jayul', HOME_IP), 403, 'IP_NOT_ALLOWED');

      // 10분이 지나면 다시 로그인할 수 있다
      clock.set('2026-12-01T10:10:01');
      expect((await attempt(PASSWORD)).status).toBe(201);
    });

    it('잠금은 걸리는 순간 이력에 한 번만 남는다', async () => {
      const res = await call('get', '/logs', { token: lead, query: { limit: '300', category: 'ACCESS' } });
      const locks = res.body.filter((l: { action: string }) => l.action === 'LOGIN_LOCKED');
      expect(locks).toHaveLength(1);
      expect(locks[0]).toMatchObject({ category: 'ACCESS', detail: { loginId: 'jayul' } });
    });
  });
});
