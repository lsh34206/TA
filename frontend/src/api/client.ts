import { clearSession, session } from '../stores/session'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  status: number
  code: string
  data: any

  constructor(status: number, code: string, message: string, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

type Query = Record<string, string | number | undefined | null>

function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function messageOf(data: any, fallback: string) {
  const message = data?.message
  if (Array.isArray(message)) return message.join('\n')
  return typeof message === 'string' ? message : fallback
}

async function send(method: string, path: string, body?: unknown, query?: Query) {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결할 수 없습니다.', null)
  }

  if (res.ok) return res

  const data = await res.json().catch(() => null)
  const error = new ApiError(
    res.status,
    data?.code ?? 'ERROR',
    messageOf(data, '요청을 처리하지 못했습니다.'),
    data,
  )
  const isLogin = path === '/auth/login'
  if (res.status === 401 && !isLogin) clearSession()
  if (res.status === 403 && error.code === 'IP_NOT_ALLOWED' && !isLogin) {
    session.blocked = { message: error.message, ip: data?.ip ?? '' }
  }
  throw error
}

async function json<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  return (await send(method, path, body, query)).json() as Promise<T>
}

export const api = {
  get: <T>(path: string, query?: Query) => json<T>('GET', path, undefined, query),
  post: <T>(path: string, body: unknown = {}) => json<T>('POST', path, body),
  patch: <T>(path: string, body: unknown = {}) => json<T>('PATCH', path, body),
  delete: <T>(path: string) => json<T>('DELETE', path),

  /** 인증이 필요한 파일을 받아 브라우저 다운로드로 저장한다 */
  async download(path: string) {
    const res = await send('GET', path)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
    const filename = encoded ? decodeURIComponent(encoded) : 'download'

    const url = URL.createObjectURL(await res.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  },
}
