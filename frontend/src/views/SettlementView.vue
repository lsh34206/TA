<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError, api } from '../api/client'
import type { Attendance, Settlement, SettlementRow } from '../api/types'
import { session } from '../stores/session'
import { currentMonth, fmtDate, fmtMinutes, fmtTime } from '../utils/format'
import { WORK_TYPE_LABEL } from '../utils/labels'

const month = ref(currentMonth())
const data = ref<Settlement | null>(null)
const error = ref('')

const selected = ref<SettlementRow | null>(null)
const records = ref<Attendance[]>([])

const isLead = computed(() => session.user?.role === 'LEAD')

async function load() {
  try {
    data.value = await api.get<Settlement>('/settlement', { month: month.value })
    error.value = ''
    // 팀원은 본인 행, 리드는 선택한 행의 일별 기록을 보여준다
    const current = data.value.rows.find((r) => r.userId === selected.value?.userId)
    await select(current ?? (isLead.value ? null : (data.value.rows[0] ?? null)))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '정산을 불러오지 못했습니다.'
  }
}

async function select(row: SettlementRow | null) {
  selected.value = row
  records.value = row
    ? await api.get<Attendance[]>('/attendance', { month: month.value, userId: row.userId })
    : []
}

const totals = computed(() => {
  const rows = data.value?.rows ?? []
  return {
    workDays: rows.reduce((s, r) => s + r.workDays, 0),
    workMinutes: rows.reduce((s, r) => s + r.workMinutes, 0),
    late: rows.reduce((s, r) => s + r.lateCount, 0),
    early: rows.reduce((s, r) => s + r.earlyLeaveCount, 0),
  }
})

watch(month, () => month.value && load())
onMounted(load)
</script>

<template>
  <div class="row between">
    <h1 class="page-title">월별 정산</h1>
    <input v-model="month" type="month" class="month" aria-label="월" />
  </div>

  <p v-if="error" class="alert error">{{ error }}</p>

  <section v-if="data" class="card">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>이름</th>
            <th class="num">근무일</th>
            <th class="num">근무시간</th>
            <th class="num">지각</th>
            <th class="num">조퇴</th>
            <th class="num">연차</th>
            <th class="num">재택</th>
            <th class="num">OFF</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data.rows"
            :key="row.userId"
            :class="{ pick: isLead, active: selected?.userId === row.userId }"
            @click="isLead && select(row)"
          >
            <td>{{ row.name }}</td>
            <td class="num">
              {{ row.workDays }}일
              <div v-if="row.weekendWorkDays || row.remoteDays" class="muted small">
                <template v-if="row.remoteDays">재택 {{ row.remoteDays }}</template>
                <template v-if="row.remoteDays && row.weekendWorkDays"> · </template>
                <template v-if="row.weekendWorkDays">휴일 {{ row.weekendWorkDays }}</template>
              </div>
            </td>
            <td class="num">{{ fmtMinutes(row.workMinutes) }}</td>
            <td class="num">{{ row.lateCount }}</td>
            <td class="num">{{ row.earlyLeaveCount }}</td>
            <td class="num">{{ row.balances.annual }}일</td>
            <td class="num">{{ row.balances.remote }}회</td>
            <td class="num">{{ row.balances.off }}개</td>
            <td>
              <div class="row">
                <span v-if="row.missingCount" class="badge danger">퇴근 미기록 {{ row.missingCount }}</span>
                <span v-if="row.manualCount" class="badge">직접 입력 {{ row.manualCount }}</span>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="isLead && data.rows.length > 1">
          <tr>
            <td>합계</td>
            <td class="num">{{ totals.workDays }}일</td>
            <td class="num">{{ fmtMinutes(totals.workMinutes) }}</td>
            <td class="num">{{ totals.late }}</td>
            <td class="num">{{ totals.early }}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="muted small note">
      잔여는 {{ data.asOf }} 기준입니다. 재택은 해당 월에 남은 횟수이며 다음 달로 이월되지 않습니다.
    </p>
  </section>

  <section v-if="selected" class="card">
    <h2 class="card-title">{{ selected.name }} · {{ month }} 일별 기록</h2>
    <div v-if="records.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>구분</th>
            <th>출근</th>
            <th>퇴근</th>
            <th class="num">근무시간</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td>{{ fmtDate(r.workDate) }}</td>
            <td>{{ WORK_TYPE_LABEL[r.workType] }}</td>
            <td>{{ fmtTime(r.clockIn) }}</td>
            <td>{{ fmtTime(r.clockOut) }}</td>
            <td class="num">{{ fmtMinutes(r.workMinutes) }}</td>
            <td>
              <div class="row">
                <span v-if="r.isLate" class="badge danger">지각</span>
                <span v-if="r.isEarlyLeave" class="badge warn">조퇴</span>
                <span v-if="r.clockOutManual" class="badge">직접 입력</span>
                <span v-if="!r.clockOut" class="badge">퇴근 미기록</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">출퇴근 기록이 없습니다.</p>
  </section>
  <p v-else-if="isLead && data" class="muted small">이름을 누르면 일별 기록을 볼 수 있습니다.</p>
</template>

<style scoped>
.month {
  width: auto;
}

tr.pick {
  cursor: pointer;
}

tr.pick:hover td,
tr.active td {
  background: var(--primary-soft);
}

tfoot td {
  font-weight: 700;
  border-top: 1px solid var(--border);
}

.note {
  margin-top: 12px;
}
</style>
