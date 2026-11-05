import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { ActivityLogService } from '../core/activity-log.service.js';
import { isValidIp, normalizeIp } from '../rules/application.rules.js';
import { DataStore } from '../store/data-store.js';

/**
 * 연구실 IP 관리. 여기에 등록된 IP에서는 상시 접속할 수 있다.
 * (재택·휴일 근무는 신청서에 적은 IP·시간대에서만 접속할 수 있으며 이 목록과 별개다.)
 */
@Injectable()
export class AllowedIpsService {
  constructor(
    private readonly store: DataStore,
    private readonly logs: ActivityLogService,
  ) {}

  /** `currentIp`는 지금 요청한 사람의 접속 IP. 목록에서 "지금 접속 중"을 표시하는 데 쓴다 */
  list(currentIp: string) {
    return this.store.allowedIps
      .all()
      .map((r) => this.toDto(r, currentIp))
      .sort((a, b) => a.id - b.id);
  }

  async add(user: AuthUser, ip: string, input: { ip: string; label?: string }) {
    const value = normalizeIp(input.ip);
    if (!isValidIp(value)) {
      throw new AppError(400, 'INVALID_IP', 'IP 주소 형식이 올바르지 않습니다. (예: 203.0.113.10)');
    }
    if (this.store.allowedIps.find((r) => normalizeIp(r.ip) === value)) {
      throw new AppError(409, 'DUPLICATE_IP', '이미 등록된 IP입니다.');
    }
    const label = input.label?.trim() || null;
    const created = this.store.allowedIps.insert({ ip: value, label });
    await this.store.commit();
    await this.logs.log('IP_ADD', { userId: user.id, ip, detail: { ip: value, label } });
    return this.toDto(created, ip);
  }

  async rename(user: AuthUser, ip: string, id: number, rawLabel: string) {
    const target = this.find(id);
    const label = rawLabel.trim() || null;
    const updated = this.store.allowedIps.update(id, { label });
    await this.store.commit();
    await this.logs.log('IP_UPDATE', {
      userId: user.id,
      ip,
      detail: { ip: normalizeIp(target.ip), label },
    });
    return this.toDto(updated, ip);
  }

  async remove(user: AuthUser, ip: string, id: number) {
    const target = this.find(id);
    const value = normalizeIp(target.ip);
    // 마지막 하나를 지우면 모두가 연구실에서 접속하지 못하고, 지금 접속 중인 IP를 지우면 본인이 바로 접속을 잃는다.
    if (this.store.allowedIps.all().length <= 1) {
      throw new AppError(400, 'LAST_IP', '마지막 IP는 삭제할 수 없습니다. 먼저 다른 IP를 등록하세요.');
    }
    if (value === ip) {
      throw new AppError(400, 'CURRENT_IP', '현재 접속 중인 IP는 삭제할 수 없습니다. 다른 IP에서 삭제하세요.');
    }
    this.store.allowedIps.remove((r) => r.id === id);
    await this.store.commit();
    await this.logs.log('IP_REMOVE', { userId: user.id, ip, detail: { ip: value, label: target.label } });
    return { id };
  }

  private find(id: number) {
    const target = this.store.allowedIps.get(id);
    if (!target) throw new AppError(404, 'IP_NOT_FOUND', '등록된 IP를 찾을 수 없습니다.');
    return target;
  }

  private toDto(row: { id: number; ip: string; label: string | null }, currentIp: string) {
    const ip = normalizeIp(row.ip);
    return { id: row.id, ip, label: row.label, current: ip === currentIp };
  }
}
