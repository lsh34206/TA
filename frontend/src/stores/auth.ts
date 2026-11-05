import { api } from '../api/client'
import type { AuthUser, Me } from '../api/types'
import { clearSession, session, setToken } from './session'

export async function login(loginId: string, password: string) {
  const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', { loginId, password })
  setToken(res.token)
  await loadMe()
}

async function loadMe() {
  const me = await api.get<Me>('/auth/me')
  session.user = me.user
  session.ip = me.ip
  session.isLabIp = me.isLabIp
  session.blocked = null
}

/** 새로고침 후 저장된 토큰으로 로그인 상태를 복원한다 */
export async function restore() {
  if (session.token) {
    try {
      await loadMe()
    } catch {
      // 만료·차단된 경우: 401은 api 클라이언트가 세션을 비우고, IP 차단은 blocked 화면으로 안내한다
    }
  }
  session.ready = true
}

export function logout() {
  clearSession()
}
