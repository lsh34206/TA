<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ApiError, api } from '../api/client'
import type { AllowedIp } from '../api/types'
import ConfirmModal from '../components/ConfirmModal.vue'
import { session } from '../stores/session'

const items = ref<AllowedIp[]>([])
const loaded = ref(false)
const ip = ref('')
const label = ref('')
const error = ref('')
const busy = ref(false)

const editingId = ref<number | null>(null)
const editLabel = ref('')

const myIp = computed(() => session.ip)
const myIpRegistered = computed(() => items.value.some((r) => r.ip === myIp.value))

async function load() {
  items.value = await api.get<AllowedIp[]>('/allowed-ips')
  loaded.value = true
}

/** 변경을 처리한 뒤 목록을 다시 불러온다. action을 생략하면 목록만 불러온다. */
async function run(action?: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await action?.()
    await load()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '요청을 처리하지 못했습니다.'
  } finally {
    busy.value = false
  }
}

const add = () =>
  run(async () => {
    await api.post('/allowed-ips', { ip: ip.value.trim(), label: label.value.trim() })
    ip.value = ''
    label.value = ''
  })

const editInput = ref<HTMLInputElement | null>(null)

async function startEdit(item: AllowedIp) {
  editingId.value = item.id
  editLabel.value = item.label ?? ''
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

const saveEdit = (item: AllowedIp) =>
  run(async () => {
    await api.patch(`/allowed-ips/${item.id}`, { label: editLabel.value.trim() })
    editingId.value = null
  })

const removing = ref<AllowedIp | null>(null)
const removingName = computed(() =>
  removing.value ? (removing.value.label ? `${removing.value.ip} (${removing.value.label})` : removing.value.ip) : '',
)

async function confirmRemove() {
  const item = removing.value
  if (!item) return
  removing.value = null
  await run(() => api.delete(`/allowed-ips/${item.id}`))
}

function deleteBlockedReason(item: AllowedIp): string {
  if (items.value.length <= 1) return '마지막 IP는 삭제할 수 없습니다.'
  if (item.current) return '현재 접속 중인 IP는 삭제할 수 없습니다.'
  return ''
}

onMounted(() => run())
</script>

<template>
  <div class="row between">
    <h1 class="page-title">접속 IP</h1>
    <span class="muted small">연구실 IP {{ items.length }}개</span>
  </div>

  <p class="muted small">
    여기에 등록한 IP에서는 언제든 접속할 수 있습니다. 재택·주말/공휴일 근무는 신청서에 적은 날짜·시간대·IP에서만
    접속할 수 있으며, 이 목록과는 별개입니다.
  </p>

  <p v-if="error" class="alert error">{{ error }}</p>

  <section class="card ip-card">
    <form class="row add" @submit.prevent="add">
      <input
        v-model="ip"
        placeholder="IP 주소 (예: 203.0.113.10)"
        maxlength="45"
        required
        spellcheck="false"
        aria-label="IP 주소"
      />
      <input v-model="label" placeholder="이름 (예: 본관 2층)" maxlength="50" aria-label="이름" />
      <button class="btn btn-primary" :disabled="busy">등록</button>
    </form>

    <p v-if="myIp && loaded && !myIpRegistered" class="hint small">
      지금 접속한 IP는 <strong>{{ myIp }}</strong>이며 등록되어 있지 않습니다.
      <button type="button" class="link" @click="ip = myIp">입력란에 넣기</button>
    </p>

    <div v-if="items.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>IP</th>
            <th>이름</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <div class="row ip-cell">
                <span class="mono">{{ item.ip }}</span>
                <span v-if="item.current" class="badge info">지금 접속 중</span>
              </div>
            </td>
            <td class="name-cell">
              <form v-if="editingId === item.id" class="row edit" @submit.prevent="saveEdit(item)">
                <input
                  :ref="(el) => (editInput = el as HTMLInputElement | null)"
                  v-model="editLabel"
                  maxlength="50"
                  placeholder="이름"
                  aria-label="이름"
                  @keydown.esc="editingId = null"
                />
                <button class="btn btn-sm btn-primary" :disabled="busy">저장</button>
                <button type="button" class="btn btn-sm" @click="editingId = null">취소</button>
              </form>
              <span v-else :class="{ muted: !item.label }">{{ item.label ?? '-' }}</span>
            </td>
            <td class="num actions">
              <template v-if="editingId !== item.id">
                <button class="btn btn-sm" :disabled="busy" @click="startEdit(item)">수정</button>
                <button
                  class="btn btn-sm btn-danger"
                  :disabled="busy || deleteBlockedReason(item) !== ''"
                  :title="deleteBlockedReason(item)"
                  @click="removing = item"
                >
                  삭제
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="loaded" class="empty">등록된 IP가 없습니다.</p>
  </section>

  <ConfirmModal
    v-if="removing"
    title="접속 IP 삭제"
    :message="`${removingName}을(를) 삭제할까요?\n이 IP에서는 연구실 접속이 더 이상 허용되지 않습니다.`"
    confirm-label="삭제"
    danger
    @confirm="confirmRemove"
    @close="removing = null"
  />
</template>

<style scoped>
.add {
  margin-bottom: 12px;
  flex-wrap: nowrap;
}

.add input:first-child {
  flex: 1.2;
}

.add input:nth-child(2) {
  flex: 1;
}

.hint {
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--primary-soft);
  color: var(--primary);
}

.link {
  margin-left: 6px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.table {
  margin-top: 4px;
}

.mono {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-weight: 600;
}

.name-cell {
  min-width: 96px;
  word-break: keep-all;
}

.edit {
  flex-wrap: nowrap;
}

.edit input {
  min-width: 120px;
}

.actions {
  white-space: nowrap;
}

.actions .btn + .btn {
  margin-left: 6px;
}

@media (max-width: 560px) {
  .ip-card {
    padding: 14px;
  }

  .ip-card .table td,
  .ip-card .table th {
    padding-right: 6px;
    padding-left: 6px;
  }

  .name-cell {
    min-width: 72px;
  }

  .mono {
    font-size: 13px;
  }

  .add {
    flex-wrap: wrap;
  }

  .add input {
    flex: 1 1 100% !important;
  }
}
</style>
