<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError, api } from '../api/client'
import type { LogCategory, LogEntry, TeamBoard } from '../api/types'
import { session } from '../stores/session'
import { fmtDate, fmtTimeSec, kstDateOf, todayKst } from '../utils/format'
import { ACTION_LABEL, ALERT_ACTIONS, CATEGORY_LABEL, CATEGORY_TONE } from '../utils/labels'
import { describeLog } from '../utils/logs'

const PAGE = 100

const CATEGORY_TABS: { value: LogCategory | ''; label: string }[] = [
  { value: '', label: '전체' },
  ...(Object.keys(CATEGORY_LABEL) as LogCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABEL[value],
  })),
]

const logs = ref<LogEntry[]>([])
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')

const category = ref<LogCategory | ''>('')
const userId = ref('')
const from = ref('')
const to = ref('')
const members = ref<{ id: number; name: string }[]>([])

const isLead = computed(() => session.user?.role === 'LEAD')
const filtered = computed(() => category.value !== '' || userId.value !== '' || from.value !== '' || to.value !== '')

const nameOf = (id: number) => members.value.find((m) => m.id === id)?.name ?? null

/** 같은 날(KST)의 이력끼리 묶는다. 목록이 최신순이라 이어진 것끼리만 비교하면 된다. */
const groups = computed(() => {
  const out: { date: string; items: LogEntry[] }[] = []
  for (const log of logs.value) {
    const date = kstDateOf(log.createdAt)
    const last = out[out.length - 1]
    if (last?.date === date) last.items.push(log)
    else out.push({ date, items: [log] })
  }
  return out
})

const today = todayKst()
const isAlert = (log: LogEntry) => ALERT_ACTIONS.includes(log.action)
const tone = (log: LogEntry) => (isAlert(log) ? 'danger' : log.category ? CATEGORY_TONE[log.category] : 'gray')

// 필터를 바꾸는 사이 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 요청에 번호를 붙인다.
let requestNo = 0

async function load(more = false) {
  const no = ++requestNo
  loading.value = true
  try {
    const before = more ? logs.value[logs.value.length - 1]?.id : undefined
    const page = await api.get<LogEntry[]>('/logs', {
      limit: PAGE,
      before,
      category: category.value,
      userId: isLead.value ? userId.value : '',
      from: from.value,
      to: to.value,
    })
    if (no !== requestNo) return
    logs.value = more ? [...logs.value, ...page] : page
    hasMore.value = page.length === PAGE
    error.value = ''
  } catch (e) {
    if (no !== requestNo) return
    error.value = e instanceof ApiError ? e.message : '이력을 불러오지 못했습니다.'
  } finally {
    if (no === requestNo) loading.value = false
  }
}

function reset() {
  category.value = ''
  userId.value = ''
  from.value = ''
  to.value = ''
}

async function loadMembers() {
  try {
    const board = await api.get<TeamBoard>('/dashboard/team')
    members.value = board.members.map((m) => ({ id: m.userId, name: m.name }))
  } catch {
    // 사용자 필터만 비어 보일 뿐 이력 조회에는 영향이 없다
  }
}

watch([category, userId, from, to], () => load())
onMounted(() => {
  load()
  if (isLead.value) loadMembers()
})
</script>

<template>
  <div class="row between">
    <h1 class="page-title">이력</h1>
    <span class="muted small">{{ isLead ? '팀 전체' : '내 이력' }}</span>
  </div>

  <p v-if="error" class="alert error">{{ error }}</p>

  <section class="card filters">
    <div class="tabs" role="group" aria-label="분류">
      <button
        v-for="tab in CATEGORY_TABS"
        :key="tab.value"
        type="button"
        class="tab"
        :class="{ active: category === tab.value }"
        :aria-pressed="category === tab.value"
        @click="category = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="row narrow">
      <select v-if="isLead" v-model="userId" aria-label="사용자">
        <option value="">전체 사용자</option>
        <option v-for="m in members" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
      </select>
      <input v-model="from" type="date" :max="to || undefined" aria-label="시작일" />
      <span class="muted">~</span>
      <input v-model="to" type="date" :min="from || undefined" aria-label="종료일" />
      <button v-if="filtered" type="button" class="btn btn-ghost btn-sm" @click="reset">필터 초기화</button>
    </div>
  </section>

  <section v-if="groups.length" class="stack">
    <div v-for="group in groups" :key="group.date" class="card day">
      <div class="day-head">
        <strong>{{ fmtDate(group.date) }}</strong>
        <span v-if="group.date === today" class="badge info">오늘</span>
        <span class="muted small">{{ group.items.length }}건</span>
      </div>

      <ul class="list">
        <li v-for="log in group.items" :key="log.id" class="item" :class="{ warning: isAlert(log) }">
          <span class="time muted small">{{ fmtTimeSec(log.createdAt) }}</span>
          <span class="badge" :class="tone(log)">{{ ACTION_LABEL[log.action] ?? log.action }}</span>
          <span class="what">
            <strong v-if="isLead && log.userName" class="who">{{ log.userName }}</strong>
            {{ describeLog(log, nameOf) }}
          </span>
          <span class="ip muted small">{{ log.ip ?? '' }}</span>
        </li>
      </ul>
    </div>
  </section>
  <section v-else-if="!loading" class="card">
    <p class="empty">{{ filtered ? '조건에 맞는 이력이 없습니다.' : '이력이 없습니다.' }}</p>
  </section>

  <div v-if="hasMore" class="more">
    <button class="btn" :disabled="loading" @click="load(true)">더 보기</button>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 12px 16px;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: var(--gray-soft);
}

.tab {
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.tab:hover:not(.active) {
  color: var(--text);
}

.tab.active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 10%);
}

.narrow select,
.narrow input {
  width: auto;
  min-height: 34px;
}

.day {
  padding: 4px 20px 8px;
}

.day-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 8px;
  border-bottom: 1px solid var(--border);
}

.day-head .small {
  margin-left: auto;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  grid-template-columns: 68px 112px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.item:last-child {
  border-bottom: none;
}

.item.warning .what {
  color: var(--danger);
}

.time {
  font-variant-numeric: tabular-nums;
}

.item .badge {
  justify-self: start;
}

.what {
  overflow-wrap: anywhere;
}

.who {
  margin-right: 6px;
}

.ip {
  font-variant-numeric: tabular-nums;
}

.more {
  display: flex;
  justify-content: center;
}

@media (max-width: 640px) {
  .filters {
    align-items: stretch;
  }

  .tabs {
    width: 100%;
  }

  .tab {
    flex: 1;
    padding: 0 6px;
  }

  .narrow {
    width: 100%;
  }

  .narrow select {
    flex: 1 1 100%;
  }

  .narrow input[type='date'] {
    flex: 1 1 0;
    min-width: 0;
  }

  .item {
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'badge badge time'
      'what what what'
      'ip ip ip';
  }

  .item .time {
    grid-area: time;
  }

  .item .badge {
    grid-area: badge;
  }

  .item .what {
    grid-area: what;
  }

  .item .ip {
    grid-area: ip;
  }
}
</style>
