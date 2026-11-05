<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { logout } from '../stores/auth'
import { session } from '../stores/session'
import { ROLE_LABEL } from '../utils/labels'
</script>

<template>
  <header class="header">
    <div class="inner">
      <RouterLink to="/" class="brand">근태관리</RouterLink>
      <nav class="nav">
        <RouterLink to="/">대시보드</RouterLink>
        <RouterLink to="/applications">신청</RouterLink>
        <RouterLink to="/settlement">정산</RouterLink>
        <RouterLink to="/logs">이력</RouterLink>
        <RouterLink v-if="session.user?.role === 'LEAD'" to="/holidays">공휴일</RouterLink>
        <RouterLink v-if="session.user?.role === 'LEAD'" to="/allowed-ips">접속 IP</RouterLink>
      </nav>
      <div class="user">
        <span class="name">{{ session.user?.name }}</span>
        <span class="badge info">{{ session.user ? ROLE_LABEL[session.user.role] : '' }}</span>
        <span class="ip muted small" :title="session.isLabIp ? '연구실 IP' : '등록된 신청 IP'">
          {{ session.ip }}
        </span>
        <button class="btn btn-ghost btn-sm" @click="logout">로그아웃</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.inner {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 16px;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.brand {
  font-size: 17px;
  font-weight: 800;
  color: var(--text);
}

.nav {
  display: flex;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
}

.nav a {
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}

.nav a:hover {
  background: var(--gray-soft);
}

.nav a.router-link-exact-active {
  background: var(--primary-soft);
  color: var(--primary);
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  font-weight: 600;
}

@media (max-width: 760px) {
  .inner {
    gap: 8px 16px;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .nav {
    order: 3;
    flex-basis: 100%;
  }

  .ip {
    display: none;
  }

  .user {
    margin-left: auto;
  }
}
</style>
