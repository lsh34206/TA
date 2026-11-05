<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ApiError, api } from '../api/client'
import type { Application, ApplicationStatus, ApplicationType, Balances } from '../api/types'
import AppModal from '../components/AppModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { session } from '../stores/session'
import { addDays, fmtDate, fmtDateTime, todayKst } from '../utils/format'
import { STATUS_LABEL, STATUS_TONE, TYPE_LABEL } from '../utils/labels'

const isLead = computed(() => session.user?.role === 'LEAD')

// ---------- 신청서 작성 ----------
const form = reactive({
  type: 'ANNUAL' as ApplicationType,
  targetDate: '',
  reason: '',
  ip: '',
  startTime: '09:00',
  endTime: '18:00',
})
const needsAccess = computed(() => form.type === 'REMOTE' || form.type === 'WEEKEND_WORK')
const minDate = computed(() => addDays(todayKst(), 1))
const balances = ref<Balances | null>(null)
const submitting = ref(false)
const formError = ref('')
const formNotice = ref('')

async function submit() {
  submitting.value = true
  formError.value = ''
  formNotice.value = ''
  try {
    await api.post('/applications', {
      type: form.type,
      targetDate: form.targetDate,
      reason: form.reason,
      ...(needsAccess.value
        ? { ip: form.ip, startTime: form.startTime, endTime: form.endTime }
        : {}),
    })
    formNotice.value = '신청했습니다.'
    form.targetDate = ''
    form.reason = ''
    await Promise.all([loadList(), loadBalances()])
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '신청하지 못했습니다.'
  } finally {
    submitting.value = false
  }
}

// ---------- 목록 ----------
const scope = ref<'me' | 'team'>('me')
const month = ref('')
const status = ref<ApplicationStatus | ''>('')
const items = ref<Application[]>([])
const listError = ref('')
const busyId = ref<number | null>(null)

async function loadBalances() {
  balances.value = await api.get<Balances>('/balances/me')
}

async function loadList() {
  try {
    items.value = await api.get<Application[]>('/applications', {
      scope: scope.value,
      month: month.value,
      status: status.value,
    })
    listError.value = ''
  } catch (e) {
    listError.value = e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.'
  }
}

async function act(item: Application, action: () => Promise<unknown>) {
  busyId.value = item.id
  listError.value = ''
  try {
    await action()
    await Promise.all([loadList(), loadBalances()])
  } catch (e) {
    listError.value = e instanceof ApiError ? e.message : '요청을 처리하지 못했습니다.'
  } finally {
    busyId.value = null
  }
}

// 신청 취소는 확인을 받고 처리한다
const cancelling = ref<Application | null>(null)
async function confirmCancel() {
  const item = cancelling.value
  if (!item) return
  cancelling.value = null
  await act(item, () => api.post(`/applications/${item.id}/cancel`))
}
const approve = (item: Application) => act(item, () => api.post(`/applications/${item.id}/approve`))
const downloadPdf = (item: Application) =>
  act(item, () => api.download(`/applications/${item.id}/pdf`))

// 반려는 사유를 함께 남긴다
const rejecting = ref<Application | null>(null)
const rejectNote = ref('')
async function confirmReject() {
  const item = rejecting.value
  if (!item) return
  rejecting.value = null
  await act(item, () => api.post(`/applications/${item.id}/reject`, { note: rejectNote.value }))
  rejectNote.value = ''
}

watch([scope, month, status], loadList)
onMounted(() => Promise.all([loadList(), loadBalances()]))
</script>

<template>
  <h1 class="page-title">신청</h1>

  <section class="card">
    <h2 class="card-title">신청서 작성</h2>
    <form class="stack" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field">
          <label for="type">종류</label>
          <select id="type" v-model="form.type">
            <option v-for="(label, type) in TYPE_LABEL" :key="type" :value="type">{{ label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="date">대상 일자</label>
          <input id="date" v-model="form.targetDate" type="date" :min="minDate" required />
        </div>

        <template v-if="needsAccess">
          <div class="field">
            <label for="ip">접속 IP</label>
            <input id="ip" v-model="form.ip" placeholder="예) 203.0.113.10" required />
          </div>
          <div class="field">
            <label for="start">시작</label>
            <input id="start" v-model="form.startTime" type="time" required />
          </div>
          <div class="field">
            <label for="end">종료</label>
            <input id="end" v-model="form.endTime" type="time" required />
          </div>
        </template>

        <div class="field wide">
          <label for="reason">사유</label>
          <textarea id="reason" v-model="form.reason" rows="2" maxlength="500" required />
        </div>
      </div>

      <p v-if="needsAccess" class="muted small">
        신청한 날짜·시간대에 위 IP에서만 접속하고 출퇴근할 수 있습니다. 현재 접속 IP는
        <button type="button" class="link" @click="form.ip = session.ip">{{ session.ip }}</button>
        입니다.
      </p>
      <p class="muted small">
        신청 기한은 대상일의 전 영업일 17:00까지입니다.
        <template v-if="balances">
          · 연차 {{ balances.annual.remaining }}일 · 재택({{ balances.remote.month.slice(5) }}월)
          {{ balances.remote.remaining }}회 · OFF {{ balances.off.remaining }}개 남음
        </template>
      </p>

      <p v-if="formError" class="alert error">{{ formError }}</p>
      <p v-if="formNotice" class="alert success">{{ formNotice }}</p>

      <div>
        <button class="btn btn-primary" :disabled="submitting">신청</button>
      </div>
    </form>
  </section>

  <section class="card">
    <div class="row between head">
      <div class="row">
        <button class="btn btn-sm" :class="{ 'btn-primary': scope === 'me' }" @click="scope = 'me'">
          내 신청
        </button>
        <button
          v-if="isLead"
          class="btn btn-sm"
          :class="{ 'btn-primary': scope === 'team' }"
          @click="scope = 'team'"
        >
          팀 신청
        </button>
      </div>
      <div class="row">
        <input v-model="month" type="month" class="filter" aria-label="월" />
        <select v-model="status" class="filter" aria-label="상태">
          <option value="">전체 상태</option>
          <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
    </div>

    <p v-if="listError" class="alert error">{{ listError }}</p>

    <div v-if="items.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th v-if="scope === 'team'">신청자</th>
            <th>대상일</th>
            <th>종류</th>
            <th>상태</th>
            <th>시간대 · IP</th>
            <th>사유</th>
            <th>신청 일시</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td v-if="scope === 'team'">{{ item.userName }}</td>
            <td class="nowrap">{{ fmtDate(item.targetDate) }}</td>
            <td class="nowrap">{{ TYPE_LABEL[item.type] }}</td>
            <td>
              <span class="badge" :class="STATUS_TONE[item.status]">{{ STATUS_LABEL[item.status] }}</span>
              <div v-if="item.decisionNote" class="muted small">{{ item.decisionNote }}</div>
            </td>
            <td class="nowrap">
              <template v-if="item.startTime">
                {{ item.startTime }}~{{ item.endTime }}<br />
                <span class="muted small">{{ item.ip }}</span>
              </template>
              <template v-else>-</template>
            </td>
            <td class="reason">{{ item.reason }}</td>
            <td class="nowrap muted small">{{ fmtDateTime(item.createdAt) }}</td>
            <td>
              <div class="row actions">
                <button class="btn btn-sm" :disabled="busyId === item.id" @click="downloadPdf(item)">
                  PDF
                </button>
                <button
                  v-if="item.canCancel"
                  class="btn btn-sm btn-danger"
                  :disabled="busyId === item.id"
                  @click="cancelling = item"
                >
                  취소
                </button>
                <template v-if="item.canDecide">
                  <button
                    class="btn btn-sm btn-primary"
                    :disabled="busyId === item.id"
                    @click="approve(item)"
                  >
                    승인
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    :disabled="busyId === item.id"
                    @click="rejecting = item"
                  >
                    반려
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">신청 내역이 없습니다.</p>
  </section>

  <ConfirmModal
    v-if="cancelling"
    title="신청 취소"
    :message="`${fmtDate(cancelling.targetDate)} ${TYPE_LABEL[cancelling.type]} 신청을 취소할까요?\n차감된 잔여가 있으면 되돌려집니다.`"
    confirm-label="신청 취소"
    danger
    @confirm="confirmCancel"
    @close="cancelling = null"
  />

  <AppModal v-if="rejecting" title="신청 반려" @close="rejecting = null">
    <p class="small">
      {{ rejecting.userName }} · {{ fmtDate(rejecting.targetDate) }}
      {{ TYPE_LABEL[rejecting.type] }} 신청을 반려합니다. 소진된 잔여는 되돌려집니다.
    </p>
    <div class="field note">
      <label for="note">반려 사유 (선택)</label>
      <textarea id="note" v-model="rejectNote" rows="3" maxlength="500" />
    </div>
    <template #footer>
      <button class="btn" @click="rejecting = null">닫기</button>
      <button class="btn btn-primary" @click="confirmReject">반려</button>
    </template>
  </AppModal>
</template>

<style scoped>
.head {
  margin-bottom: 12px;
}

.filter {
  width: auto;
  min-height: 30px;
  height: 30px;
  padding: 0 8px;
  font-size: 13px;
}

.nowrap {
  white-space: nowrap;
}

.reason {
  min-width: 140px;
  max-width: 260px;
  overflow-wrap: anywhere;
}

.actions {
  flex-wrap: nowrap;
}

.note {
  margin-top: 12px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
</style>
