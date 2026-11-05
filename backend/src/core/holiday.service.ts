import { Injectable } from '@nestjs/common';
import { isWeekend } from '../common/kst.js';
import type { BusinessDayChecker } from '../rules/application.rules.js';
import { DataStore } from '../store/data-store.js';

/**
 * 공휴일은 데이터 파일(holidays)에서 관리한다. 설날·추석 연휴, 대체공휴일, 임시공휴일은
 * 해마다 달라 코드로 계산하지 않고 리드가 등록·수정한다.
 */
@Injectable()
export class HolidayService {
  constructor(private readonly store: DataStore) {}

  /** 영업일(주말·공휴일이 아닌 날) 판별 함수. 한 번 만들어 여러 날짜에 재사용한다. */
  checker(): BusinessDayChecker {
    const holidays = new Set(this.store.holidays.all().map((h) => h.date));
    return (date) => !isWeekend(date) && !holidays.has(date);
  }

  nameOf(date: string): string | null {
    return this.store.holidays.find((h) => h.date === date)?.name ?? null;
  }

  listByYear(year: number) {
    return this.store.holidays
      .filter((h) => h.date.startsWith(`${year}-`))
      .map((h) => ({ date: h.date, name: h.name }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async upsert(date: string, name: string) {
    const existing = this.store.holidays.find((h) => h.date === date);
    if (existing) this.store.holidays.update(existing.id, { name });
    else this.store.holidays.insert({ date, name });
    await this.store.commit();
  }

  async remove(date: string) {
    this.store.holidays.remove((h) => h.date === date);
    await this.store.commit();
  }
}
