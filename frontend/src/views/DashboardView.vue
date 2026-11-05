<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError, api } from '../api/client'
import type { Attendance, Issues, MyCard, TeamBoard } from '../api/types'
import ManualClockOutModal from '../components/ManualClockOutModal.vue'
import { session } from '../stores/session'
import { fmtClock, fmtDate, fmtMinutes, fmtTime } from '../utils/format'
import { BOARD_STATUS, TYPE_LABEL, WORK_TYPE_LABEL } from '../utils/labels'

const card = ref<MyCard | null>(null)
const board = ref<TeamBoard | null>(null)
const issues = ref<Issues | null>(null)
const teamIssues = ref<Issues | null>(null)
const issueScope = ref<'me' | 'team'>('me')

const busy = ref(false)
const error = ref('')
const notice = ref('')
const manualRecords = ref<Attendance[]>([])
const retryClockIn = ref(false)

const isLead = computed(() => session.user?.role === 'LEAD')
const attendance = computed(() => card.value?.attendance ?? null)

// 현재 시각 표시 (서버 규칙이 10:00:00 기준이라 초 단위까지 보여준다)
const clock = ref(fmtClock(new Date()))
const timer = setInterval(() => (clock.value = fmtClock(new Date())), 1000)
onBeforeUnmount(() => clearInterval(timer))

const weekendApplied = computed(() =>
  card.value?.applications.some((a) => a.type === 'WEEKEND_WORK'),
)
/** 휴일인데 근무 신청이 없으면 출근할 수 없다 */
const blockedByHoliday = computed(
  () => !!card.value && !card.value.isBusinessDay && !weekendApplied.value && !attendance.value,
)

const statusText = computed(() => {
  if (!attendance.value) return '출근 전'
  return attendance.value.clockOut ? '퇴근 완료' : '근무 중'
})

const shownIssues = computed(() => (issueScope.value === 'team' ? teamIssues.value : issues.value))

async function load() {
  const [c, i] = await Promise.all([
    api.get<MyCard>('/dashboard/me'),
    api.get<Issues>('/dashboard/issues'),
  ])
  card.value = c
  issues.value = i
  if (isLead.value) {
    ;[board.value, teamIssues.value] = await Promise.all([
      api.get<TeamBoard>('/dashboard/team'),
      api.get<Issues>('/dashboard/issues', { scope: 'team' }),
    ])
  }
}

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '요청을 처리하지 못했습니다.'
  } finally {
    busy.value = false
  }
}

function clockIn() {
  return run(async () => {
    try {
      await api.post('/attendance/clock-in')
    } catch (e) {
      // 퇴근을 안 찍은 날이 있으면 입력 창을 띄우고, 입력이 끝나면 출근을 다시 시도한다
      if (e instanceof ApiError && e.code === 'MISSING_CLOCK_OUT') {
        manualRecords.value = e.data.records
        retryClockIn.value = true
        await load()
        return
      }
      throw e
    }
    notice.value = '출근을 등록했습니다.'
    await load()
  })
}

function clockOut() {
  return run(async () => {
    await api.post('/attendance/clock-out')
    notice.value = '퇴근을 등록했습니다.'
    await load()
  })
}

function openManual(record: Attendance) {
  retryClockIn.value = false
  manualRecords.value = [record]
}

async function onManualDone() {
  manualRecords.value = []
  await load()
  if (retryClockIn.value) {
    retryClockIn.value = false
    await clockIn()
  }
}

onMounted(() => run(load))
</script>

<template>
  <h1 class="page-title">대시보드</h1>

  <p v-if="error" class="alert error">{{ error }}</p>
  <p v-if="notice" class="alert success">{{ notice }}</p>

  <div v-if="card" class="grid-2">
    <!-- 내 카드 -->
    <section class="card">
      <div class="row between head">
        <h2 class="card-title nomargin">오늘</h2>
        <div class="row">
          <span v-if="card.holidayName" class="badge warn">{{ card.holidayName }}</span>
          <span v-else-if="!card.isBusinessDay" class="badge warn">주말</span>
          <span v-if="attendance" class="badge info">{{ WORK_TYPE_LABEL[attendance.workType] }}</span>
        </div>
      </div>
      <p class="muted">{{ fmtDate(card.today) }}</p>
      <p class="clock">{{ clock }}</p>

      <div class="times">
        <div>
          <span class="muted small">출근</span>
          <strong>{{ fmtTime(attendance?.clockIn ?? null) }}</strong>
          <span v-if="attendance?.isLate" class="badge danger">지각</span>
        </div>
        <div>
          <span class="muted small">퇴근</span>
          <strong>{{ fmtTime(attendance?.clockOut ?? null) }}</strong>
          <span v-if="attendance?.isEarlyLeave" class="badge warn">조퇴</span>
          <span v-if="attendance?.clockOutManual" class="badge">직접 입력</span>
        </div>
        <div>
          <span class="muted small">근무시간</span>
          <strong>{{ fmtMinutes(attendance?.workMinutes ?? null) }}</strong>
        </div>
      </div>

      <div v-if="card.applications.length" class="row applied">
        <span class="muted small">오늘 신청</span>
        <span v-for="a in card.applications" :key="a.id" class="badge info">
          {{ TYPE_LABEL[a.type] }}
        </span>
      </div>

      <p v-if="blockedByHoliday" class="alert info">
        오늘은 휴무일입니다. 근무하려면 주말·공휴일 근무를 신청해야 합니다.
      </p>

      <div class="row actions">
        <button
          class="btn btn-primary btn-lg"
          :disabled="busy || !!attendance || blockedByHoliday"
          @click="clockIn"
        >
          출근
        </button>
        <button
          class="btn btn-lg"
          :disabled="busy || !attendance || !!attendance.clockOut"
          @click="clockOut"
        >
          퇴근
        </button>
        <span class="muted small">{{ statusText }}</span>
      </div>
      <p class="muted small rules">
        출근 07:00부터 · 10:00:00을 넘기면 지각 · 퇴근 16:00부터 · 근무시간 8시간 미만은 조퇴
      </p>
    </section>

    <!-- 잔여 -->
    <section class="card">
      <h2 class="card-title">잔여</h2>
      <div class="stats">
        <div class="stat">
          <span class="muted small">연차</span>
          <strong>{{ card.balances.annual.remaining }}<small>일</small></strong>
          <span class="muted small">
            적립 {{ card.balances.annual.accrued }} · 사용 {{ card.balances.annual.used }}
          </span>
        </div>
        <div class="stat">
          <span class="muted small">재택 ({{ card.balances.remote.month.slice(5) }}월)</span>
          <strong>
            {{ card.balances.remote.remaining }}<small>/ {{ card.balances.remote.limit }}회</small>
          </strong>
          <span class="muted small">매월 초기화</span>
        </div>
        <div class="stat">
          <span class="muted small">반일 OFF</span>
          <strong>{{ card.balances.off.remaining }}<small>개</small></strong>
          <span class="muted small">
            {{
              card.balances.off.nextExpires
                ? `${card.balances.off.nextExpires.slice(5)}까지 사용`
                : '지급 후 30일 이내 사용'
            }}
          </span>
        </div>
      </div>
    </section>
  </div>

  <!-- 미기록 건 -->
  <section v-if="issues" class="card">
    <div class="row between head">
      <h2 class="card-title nomargin">미기록 건</h2>
      <div v-if="isLead" class="row">
        <button
          class="btn btn-sm"
          :class="{ 'btn-primary': issueScope === 'me' }"
          @click="issueScope = 'me'"
        >
          내 기록
        </button>
        <button
          class="btn btn-sm"
          :class="{ 'btn-primary': issueScope === 'team' }"
          @click="issueScope = 'team'"
        >
          팀 전체
        </button>
      </div>
    </div>

    <div v-if="shownIssues && (shownIssues.missing.length || shownIssues.manual.length)" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th v-if="issueScope === 'team'">이름</th>
            <th>날짜</th>
            <th>출근</th>
            <th>퇴근</th>
            <th>구분</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in shownIssues.missing" :key="`m${r.id}`">
            <td v-if="issueScope === 'team'">{{ r.userName }}</td>
            <td>{{ fmtDate(r.workDate) }}</td>
            <td>{{ fmtTime(r.clockIn) }}</td>
            <td>--:--</td>
            <td><span class="badge danger">퇴근 미기록</span></td>
            <td class="num">
              <button
                v-if="r.userId === session.user?.id"
                class="btn btn-sm"
                :disabled="busy"
                @click="openManual(r)"
              >
                입력
              </button>
            </td>
          </tr>
          <tr v-for="r in shownIssues.manual" :key="`d${r.id}`">
            <td v-if="issueScope === 'team'">{{ r.userName }}</td>
            <td>{{ fmtDate(r.workDate) }}</td>
            <td>{{ fmtTime(r.clockIn) }}</td>
            <td>{{ fmtTime(r.clockOut) }}</td>
            <td><span class="badge">직접 입력</span></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">미기록 건이 없습니다.</p>
  </section>

  <!-- 팀 보드 (리드) -->
  <section v-if="isLead && board" class="card">
    <h2 class="card-title">팀 보드</h2>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>이름</th>
            <th>상태</th>
            <th>출근</th>
            <th>퇴근</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in board.members" :key="m.userId">
            <td>{{ m.name }}</td>
            <td>
              <span class="badge" :class="BOARD_STATUS[m.status].tone">
                {{ BOARD_STATUS[m.status].label }}
              </span>
            </td>
            <td>{{ fmtTime(m.clockIn) }}</td>
            <td>{{ fmtTime(m.clockOut) }}</td>
            <td>
              <div class="row">
                <span v-if="m.workType && m.workType !== 'OFFICE'" class="badge info">
                  {{ WORK_TYPE_LABEL[m.workType] }}
                </span>
                <span v-if="m.clockIn && m.applied.includes('OFF')" class="badge info">OFF</span>
                <span v-if="m.isLate" class="badge danger">지각</span>
                <span v-if="m.isEarlyLeave" class="badge warn">조퇴</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ManualClockOutModal
    v-if="manualRecords.length"
    :records="manualRecords"
    @close="manualRecords = []"
    @done="onManualDone"
  />
</template>

<style scoped>
.head {
  margin-bottom: 4px;
}

.nomargin {
  margin: 0;
}

.clock {
  margin-top: 4px;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.times {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 16px 0;
  padding: 14px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.times > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.times strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.applied {
  margin-bottom: 12px;
}

.actions {
  margin-top: 12px;
}

.rules {
  margin-top: 12px;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg);
}

.stat strong {
  font-size: 24px;
  line-height: 1.3;
}

.stat small {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
</style>
