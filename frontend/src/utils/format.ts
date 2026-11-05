// 서버와 같은 기준(KST)으로 표시한다. 브라우저의 시간대와 무관하다.
const TZ = 'Asia/Seoul'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const clockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const dateTimeFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 'HH:mm' */
export const fmtTime = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '--:--')
/** 'HH:mm:ss' */
export const fmtClock = (date: Date) => clockFmt.format(date)
/** 'YYYY-MM-DD HH:mm' */
export const fmtDateTime = (iso: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '-')

/** 'HH:mm:ss' (KST) */
export const fmtTimeSec = (iso: string) => clockFmt.format(new Date(iso))
/** 시각 → 'YYYY-MM-DD' (KST) */
export const kstDateOf = (iso: string) => dateFmt.format(new Date(iso))

/** 오늘 날짜 'YYYY-MM-DD' (KST) */
export const todayKst = () => dateFmt.format(new Date())
export const currentMonth = () => todayKst().slice(0, 7)

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const weekdayKo = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]

/** 'YYYY-MM-DD (요일)' */
export const fmtDate = (date: string) => `${date} (${weekdayKo(date)})`

export function fmtMinutes(minutes: number | null): string {
  if (minutes === null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}
