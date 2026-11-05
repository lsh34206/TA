<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { login } from '../stores/auth'
import { session } from '../stores/session'

const router = useRouter()
const loginId = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await login(loginId.value.trim(), password.value)
    await router.replace({ name: 'dashboard' })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '로그인하지 못했습니다.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <form class="card form" @submit.prevent="submit">
      <div>
        <h1 class="title">근태관리</h1>
        <p class="muted small">등록된 IP에서만 접속할 수 있습니다.</p>
      </div>

      <div class="field">
        <label for="loginId">아이디</label>
        <input id="loginId" v-model="loginId" autocomplete="username" autofocus required />
      </div>
      <div class="field">
        <label for="password">비밀번호</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="alert error">{{ error }}</p>
      <p v-else-if="session.blocked" class="alert error">{{ session.blocked.message }}</p>

      <button class="btn btn-primary btn-lg" :disabled="busy">로그인</button>
    </form>
  </main>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.form {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
}

.title {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 4px;
}
</style>
