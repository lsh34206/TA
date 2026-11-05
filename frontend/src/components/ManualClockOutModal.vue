<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ApiError, api } from '../api/client'
import type { Attendance } from '../api/types'
import { fmtDate, fmtTime } from '../utils/format'
import AppModal from './AppModal.vue'

const props = defineProps<{ records: Attendance[] }>()
const emit = defineEmits<{ close: []; done: [] }>()

const DEFAULT_TIME = '18:00'

const pending = ref<Attendance[]>([...props.records])
const times = reactive<Record<number, string>>(
  Object.fromEntries(props.records.map((r) => [r.id, DEFAULT_TIME])),
)
const errors = reactive<Record<number, string>>({})
const saving = ref(false)

const canSubmit = computed(() => pending.value.every((r) => times[r.id]) && !saving.value)

/** 위에서부터 차례로 저장하고, 실패한 행에서 멈춘다 */
async function submit() {
  saving.value = true
  try {
    for (const record of [...pending.value]) {
      try {
        await api.post('/attendance/manual-clock-out', {
          attendanceId: record.id,
          time: times[record.id],
        })
        delete errors[record.id]
        pending.value = pending.value.filter((r) => r.id !== record.id)
      } catch (e) {
        errors[record.id] = e instanceof ApiError ? e.message : '저장하지 못했습니다.'
        return
      }
    }
    emit('done')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal title="퇴근 시각 직접 입력" @close="emit('close')">
    <p class="muted small intro">
      퇴근을 등록하지 않은 날의 퇴근 시각을 입력해 주세요. 직접 입력한 기록은 '직접 입력'으로
      표시됩니다.
    </p>
    <table class="table">
      <thead>
        <tr>
          <th>날짜</th>
          <th>출근</th>
          <th>퇴근 시각</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="record in pending" :key="record.id">
          <tr>
            <td>{{ fmtDate(record.workDate) }}</td>
            <td>{{ fmtTime(record.clockIn) }}</td>
            <td><input v-model="times[record.id]" type="time" required /></td>
          </tr>
          <tr v-if="errors[record.id]">
            <td colspan="3" class="err">{{ errors[record.id] }}</td>
          </tr>
        </template>
      </tbody>
    </table>
    <template #footer>
      <button class="btn" @click="emit('close')">닫기</button>
      <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">저장</button>
    </template>
  </AppModal>
</template>

<style scoped>
.intro {
  margin-bottom: 12px;
}

.err {
  color: var(--danger);
  font-size: 13px;
  padding-top: 0;
}
</style>
