import { createRouter, createWebHistory } from 'vue-router'
import { restore } from './stores/auth'
import { session } from './stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    leadOnly?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
    { path: '/applications', name: 'applications', component: () => import('./views/ApplicationsView.vue') },
    { path: '/settlement', name: 'settlement', component: () => import('./views/SettlementView.vue') },
    { path: '/logs', name: 'logs', component: () => import('./views/LogsView.vue') },
    {
      path: '/holidays',
      name: 'holidays',
      component: () => import('./views/HolidaysView.vue'),
      meta: { leadOnly: true },
    },
    {
      path: '/allowed-ips',
      name: 'allowed-ips',
      component: () => import('./views/AllowedIpsView.vue'),
      meta: { leadOnly: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  if (!session.ready) await restore()

  if (to.meta.public) return session.user ? { name: 'dashboard' } : true
  if (!session.user) return { name: 'login' }
  if (to.meta.leadOnly && session.user.role !== 'LEAD') return { name: 'dashboard' }
  return true
})
