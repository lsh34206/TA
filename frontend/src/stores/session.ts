import { reactive } from 'vue'
import type { AuthUser } from '../api/types'

const TOKEN_KEY = 'ta.token'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export interface BlockedInfo {
  message: string
  ip: string
}

export const session = reactive({
  token: readToken(),
  user: null as AuthUser | null,
  ip: '',
  isLabIp: false,
  /** 서버가 접속 IP·시간대 제한으로 요청을 막은 경우 */
  blocked: null as BlockedInfo | null,
  /** 저장된 토큰으로 로그인 상태 복원을 시도했는지 */
  ready: false,
})

export function setToken(token: string | null) {
  session.token = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 새로고침 시 다시 로그인한다
  }
}

export function clearSession() {
  setToken(null)
  session.user = null
  session.blocked = null
}
