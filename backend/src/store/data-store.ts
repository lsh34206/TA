import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seedInitial } from './seed.js';
import { Table } from './table.js';
import type {
  ActivityLog,
  AllowedIp,
  Application,
  Attendance,
  Holiday,
  OffGrant,
  User,
} from './types.js';

/** 업무 데이터 (사용자·IP·공휴일·출퇴근·신청·OFF). 여러 컬렉션을 한 파일로 저장해 함께 반영된다. */
const CORE_FILE = 'db.json';
/**
 * 이력은 계속 쌓이고 수정되지 않으므로 JSON Lines(한 줄에 한 건)로 둔다.
 * 기록할 때 파일 전체를 다시 쓰지 않고 새 줄만 덧붙인다.
 */
const LOG_FILE = 'activity-log.jsonl';
/** 예전 형식(JSON 배열 한 덩어리). 있으면 첫 시작 때 LOG_FILE로 옮기고 이름을 바꿔 보관한다. */
const LEGACY_LOG_FILE = 'activity-log.json';
const LEGACY_LOG_BACKUP = 'activity-log.json.bak';

/**
 * 로컬 JSON 파일 저장소.
 * 시작할 때 파일을 메모리로 읽고, 변경은 메모리에 반영한 뒤 commit()으로 파일에 저장한다.
 * 업무 데이터는 임시 파일에 쓰고 이름을 바꾸는 방식이라 중간에 끊겨도 파일이 깨지지 않고,
 * 이력은 새 줄만 덧붙인다.
 */
@Injectable()
export class DataStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataStore.name);
  private readonly dir: string;
  private readonly dirty = { core: false };
  private queue: Promise<void> = Promise.resolve();

  /** 파일에 이미 저장된 이력 개수. 이력은 추가만 되므로 이 뒤의 것이 아직 저장되지 않은 새 이력이다. */
  private persistedLogs = 0;
  /** 덧붙이기가 중간에 실패했으면 파일이 어중간할 수 있으니 다음 저장 때 전체를 새로 쓴다 */
  private rewriteLogsNext = false;

  readonly users = new Table<User>(() => (this.dirty.core = true));
  readonly allowedIps = new Table<AllowedIp>(() => (this.dirty.core = true));
  readonly holidays = new Table<Holiday>(() => (this.dirty.core = true));
  readonly attendances = new Table<Attendance>(() => (this.dirty.core = true));
  readonly applications = new Table<Application>(() => (this.dirty.core = true));
  readonly offGrants = new Table<OffGrant>(() => (this.dirty.core = true));
  /** 추가 전용. 저장 대상 판단은 persistedLogs로 하므로 변경 표시가 필요 없다. */
  readonly activityLogs = new Table<ActivityLog>(() => undefined);

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('DATA_DIR');
    // 기본 위치: backend/data (실행 위치와 무관)
    this.dir = configured ? resolve(configured) : join(import.meta.dirname, '../../data');
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });

    const core = (await this.read(CORE_FILE)) as Record<string, unknown> | null;
    const tables = {
      users: this.users,
      allowedIps: this.allowedIps,
      holidays: this.holidays,
      attendances: this.attendances,
      applications: this.applications,
      offGrants: this.offGrants,
    };
    for (const [name, table] of Object.entries(tables)) {
      // 손으로 추가한 레코드의 id를 채웠다면 저장이 필요하다
      if (table.load(core?.[name])) this.dirty.core = true;
    }

    await this.loadLogs();

    if (core === null) {
      await seedInitial(this, {
        password: this.config.get<string>('SEED_PASSWORD'),
        labIps: (this.config.get<string>('LAB_IPS') ?? '127.0.0.1').split(','),
      });
      this.logger.log('데이터 파일이 없어 초기 데이터(사용자·연구실 IP·공휴일)를 만들었습니다.');
    }

    await this.commit();
    this.logger.log(`데이터 폴더: ${this.dir}`);
  }

  async onModuleDestroy() {
    await this.commit();
  }

  /** 변경된 컬렉션을 파일에 저장한다. 저장은 한 번에 하나씩 순서대로 처리된다. */
  async commit(): Promise<void> {
    const run = this.queue.then(() => this.flush());
    this.queue = run.catch(() => undefined);
    await run;
  }

  private async flush() {
    if (this.dirty.core) {
      this.dirty.core = false;
      await this.writeAtomic(
        CORE_FILE,
        `${JSON.stringify(
          {
            users: this.users,
            allowedIps: this.allowedIps,
            holidays: this.holidays,
            attendances: this.attendances,
            applications: this.applications,
            offGrants: this.offGrants,
          },
          null,
          2,
        )}\n`,
      ).catch((error) => {
        this.dirty.core = true;
        throw error;
      });
    }
    await this.flushLogs();
  }

  // ---------- 이력(JSON Lines) ----------

  private async flushLogs() {
    const rows = this.activityLogs.all();
    if (this.rewriteLogsNext) {
      await this.rewriteLogs();
      return;
    }
    if (this.persistedLogs >= rows.length) return;

    const fresh = rows.slice(this.persistedLogs);
    try {
      await appendFile(join(this.dir, LOG_FILE), fresh.map(toLine).join(''), 'utf8');
    } catch (error) {
      this.rewriteLogsNext = true;
      throw error;
    }
    this.persistedLogs += fresh.length;
  }

  /** 이력 전체를 임시 파일에 써서 교체한다 (이전·복구용) */
  private async rewriteLogs() {
    const rows = this.activityLogs.all();
    await this.writeAtomic(LOG_FILE, rows.map(toLine).join(''));
    this.persistedLogs = rows.length;
    this.rewriteLogsNext = false;
  }

  private async loadLogs() {
    const path = join(this.dir, LOG_FILE);
    const text = await this.readText(path);

    if (text === null) {
      // 예전 형식(JSON 배열)이면 옮긴다. 원본은 지우지 않고 .bak으로 보관한다.
      const legacy = await this.read(LEGACY_LOG_FILE);
      const rows = Array.isArray(legacy) ? legacy : [];
      this.activityLogs.load(rows);
      this.persistedLogs = 0;
      if (legacy !== null) {
        if (rows.length > 0) await this.rewriteLogs();
        await rename(join(this.dir, LEGACY_LOG_FILE), join(this.dir, LEGACY_LOG_BACKUP));
        this.logger.log(
          `예전 이력 파일(${LEGACY_LOG_FILE}) ${rows.length}건을 ${LOG_FILE}로 옮겼습니다. 원본은 ${LEGACY_LOG_BACKUP}으로 보관합니다.`,
        );
      }
      return;
    }

    const { rows, needsRewrite } = this.parseLogLines(text, path);
    const assigned = this.activityLogs.load(rows);
    this.persistedLogs = this.activityLogs.all().length;
    // 손으로 추가한 줄의 id를 채웠거나, 끝이 잘린 줄을 버렸거나, 마지막 줄바꿈이 없으면 파일을 깨끗하게 다시 쓴다
    if (assigned || needsRewrite) await this.rewriteLogs();
  }

  /**
   * 한 줄에 한 건. 쓰는 도중 서버가 꺼져 **마지막 줄만** 잘린 경우는 그 줄을 버리고 계속하고,
   * 중간 줄이 깨졌다면 데이터를 잃지 않도록 오류로 멈춘다.
   */
  private parseLogLines(text: string, path: string): { rows: unknown[]; needsRewrite: boolean } {
    const lines = text.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

    const rows: unknown[] = [];
    let needsRewrite = text.length > 0 && !text.endsWith('\n');
    lines.forEach((line, index) => {
      if (line.trim() === '') return;
      try {
        rows.push(JSON.parse(line));
      } catch {
        if (index === lines.length - 1) {
          needsRewrite = true;
          this.logger.warn(`${path}의 마지막 줄이 잘려 있어 버렸습니다. (서버가 쓰는 도중 꺼졌을 수 있습니다)`);
          return;
        }
        throw new Error(
          `${path} ${index + 1}번째 줄을 읽을 수 없습니다 (JSON 형식 오류). 파일을 고치거나 옮긴 뒤 다시 실행하세요.`,
        );
      }
    });
    return { rows, needsRewrite };
  }

  // ---------- 파일 입출력 ----------

  /** 파일이 없으면 null */
  private async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** 파일이 없으면 null. 깨진 파일은 덮어쓰지 않도록 오류로 멈춘다. */
  private async read(file: string): Promise<unknown> {
    const path = join(this.dir, file);
    const text = await this.readText(path);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `${path} 파일을 읽을 수 없습니다 (JSON 형식 오류). 파일을 고치거나 옮긴 뒤 다시 실행하세요.`,
      );
    }
  }

  private async writeAtomic(file: string, body: string) {
    const target = join(this.dir, file);
    const temp = `${target}.tmp`;
    await writeFile(temp, body, 'utf8');
    try {
      await rename(temp, target);
    } catch {
      // 다른 프로그램이 대상 파일을 잡고 있으면 이름 바꾸기가 실패할 수 있다
      await writeFile(target, body, 'utf8');
      await rm(temp, { force: true });
    }
  }
}

const toLine = (row: ActivityLog) => `${JSON.stringify(row)}\n`;
