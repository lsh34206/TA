<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { logout } from './stores/auth'
import { session } from './stores/session'

const route = useRoute()
const router = useRouter()

// 토큰이 만료·삭제되면 로그인 화면으로 돌려보낸다
watch(
  () => session.token,
  (token) => {
    if (!token && route.name !== 'login') router.replace({ name: 'login' })
  },
)

function retry() {
  session.blocked = null
  router.go(0)
}
</script>

<template>
  <template v-if="!session.ready"></template>
  <RouterView v-else-if="route.name === 'login'" />
  <template v-else>
    <AppHeader />
    <main class="container">
      <section v-if="session.blocked" class="card blocked">
        <h1 class="page-title">접속할 수 없습니다</h1>
        <p class="muted">{{ session.blocked.message }}</p>
        <p v-if="session.blocked.ip" class="small">
          현재 접속 IP <strong>{{ session.blocked.ip }}</strong>
        </p>
        <div class="row">
          <button class="btn btn-primary" @click="retry">다시 시도</button>
          <button class="btn" @click="logout">로그아웃</button>
        </div>
      </section>
      <RouterView v-else />
    </main>
  </template>
</template>

<style scoped>
.blocked {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
</style>
