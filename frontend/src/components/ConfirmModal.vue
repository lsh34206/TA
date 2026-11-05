<script setup lang="ts">
import AppModal from './AppModal.vue'

// window.confirm은 브라우저·내장 뷰에 따라 뜨지 않고 바로 거절되기도 해서 화면 안의 확인 창을 쓴다.
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  /** 되돌리기 어려운 동작이면 확인 버튼을 빨간색으로 */
  danger?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <AppModal :title="title" @close="emit('close')">
    <p class="message">{{ message }}</p>
    <template #footer>
      <button class="btn" @click="emit('close')">닫기</button>
      <button
        class="btn"
        :class="danger ? 'btn-danger-fill' : 'btn-primary'"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ confirmLabel ?? '확인' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.message {
  white-space: pre-line;
}
</style>
