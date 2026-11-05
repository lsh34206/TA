export interface Row {
  id: number;
}

/**
 * 메모리에 올려 둔 레코드 목록. 읽기·쓰기는 모두 동기라서 await 없이 이어지는
 * 조회→변경은 서로 끼어들지 않는다. 디스크 반영은 DataStore.commit()이 맡는다.
 */
export class Table<T extends Row> {
  private rows: T[] = [];
  private nextId = 1;

  constructor(private readonly markDirty: () => void) {}

  /**
   * 파일에서 읽은 값을 채운다. 사람이 손으로 추가한 레코드에 id가 없으면 새로 매기고
   * true를 돌려준다(저장이 필요하다는 뜻).
   */
  load(raw: unknown): boolean {
    const rows = Array.isArray(raw) ? (raw as T[]) : [];
    this.nextId = rows.reduce((max, r) => (Number.isInteger(r.id) ? Math.max(max, r.id) : max), 0) + 1;
    let assigned = false;
    for (const row of rows) {
      if (!Number.isInteger(row.id)) {
        row.id = this.nextId++;
        assigned = true;
      }
    }
    this.rows = rows;
    return assigned;
  }

  all(): readonly T[] {
    return this.rows;
  }

  get(id: number): T | undefined {
    return this.rows.find((r) => r.id === id);
  }

  find(predicate: (row: T) => boolean): T | undefined {
    return this.rows.find(predicate);
  }

  filter(predicate: (row: T) => boolean): T[] {
    return this.rows.filter(predicate);
  }

  insert(data: Omit<T, 'id'>): T {
    const row = { ...data, id: this.nextId++ } as T;
    this.rows.push(row);
    this.markDirty();
    return row;
  }

  update(id: number, patch: Partial<Omit<T, 'id'>>): T {
    const row = this.get(id);
    if (!row) throw new Error(`레코드를 찾을 수 없습니다. (id=${id})`);
    Object.assign(row, patch);
    this.markDirty();
    return row;
  }

  remove(predicate: (row: T) => boolean): number {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !predicate(r));
    if (this.rows.length !== before) this.markDirty();
    return before - this.rows.length;
  }

  toJSON(): T[] {
    return this.rows;
  }
}
