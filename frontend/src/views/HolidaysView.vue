<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError, api } from '../api/client'
import type { Holiday } from '../api/types'
import ConfirmModal from '../components/ConfirmModal.vue'
import { addDays, fmtDate, todayKst } from '../utils/format'

const year = ref(Number(todayKst().slice(0, 4)))
const holidays = ref<Holiday[]>([])
const date = ref('')
const name = ref('')
const error = ref('')
const busy = ref(false)

const minDate = addDays(todayKst(), 1)

async function load() {
  holidays.value = await api.get<Holiday[]>('/holidays', { year: year.value })
}

async function run(action: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await action()
    await load()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '요청을 처리하지 못했습니다.'
  } finally {
    busy.value = false
  }
}

const add = () =>
  run(async () => {
    await api.post('/holidays', { date: date.value, name: name.value.trim() })
    date.value = ''
    name.value = ''
  })

const removing = ref<Holiday | null>(null)
async function confirmRemove() {
  const holiday = removing.value
  if (!holiday) return
  removing.value = null
  await run(() => api.delete(`/holidays/${holiday.date}`))
}

watch(year, () => run(load))
onMounted(() => run(load))
</script>

<template>
  <div class="row between">
    <h1 class="page-title">공휴일</h1>
    <div class="row year">
      <button class="btn btn-sm" @click="year--">‹</button>
      <strong>{{ year }}</strong>
      <button class="btn btn-sm" @click="year++">›</button>
    </div>
  </div>

  <p class="muted small">
    설날·추석 연휴, 대체공휴일, 임시공휴일은 해마다 달라 직접 등록합니다. 신청 기한(전 영업일
    17:00)과 주말·공휴일 근무 판정에 사용되며, 오늘 이전 날짜는 변경할 수 없습니다.
  </p>

  <p v-if="error" class="alert error">{{ error }}</p>

  <section class="card">
    <form class="row add" @submit.prevent="add">
      <input v-model="date" type="date" :min="minDate" required aria-label="날짜" />
      <input v-model="name" placeholder="이름 (예: 임시공휴일)" maxlength="100" required aria-label="이름" />
      <button class="btn btn-primary" :disabled="busy">등록</button>
    </form>

    <div v-if="holidays.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>이름</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in holidays" :key="h.date">
            <td>{{ fmtDate(h.date) }}</td>
            <td>{{ h.name }}</td>
            <td class="num">
              <button
                v-if="h.date > todayKst()"
                class="btn btn-sm btn-danger"
                :disabled="busy"
                @click="removing = h"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">{{ year }}년에 등록된 공휴일이 없습니다.</p>
  </section>

  <ConfirmModal
    v-if="removing"
    title="공휴일 삭제"
    :message="`${fmtDate(removing.date)} ${removing.name}을(를) 삭제할까요?`"
    confirm-label="삭제"
    danger
    @confirm="confirmRemove"
    @close="removing = null"
  />
</template>

<style scoped>
.year {
  gap: 12px;
}

.add {
  margin-bottom: 16px;
  flex-wrap: nowrap;
}

.add input[type='date'] {
  width: 170px;
  flex: none;
}

@media (max-width: 560px) {
  .add {
    flex-wrap: wrap;
  }

  .add input[type='date'] {
    width: 100%;
  }
}
</style>
