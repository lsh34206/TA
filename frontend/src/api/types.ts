export type Role = 'MEMBER' | 'LEAD'
export type ApplicationType = 'ANNUAL' | 'REMOTE' | 'OFF' | 'WEEKEND_WORK'
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type WorkType = 'OFFICE' | 'REMOTE' | 'WEEKEND_WORK'
export type BoardStatus =
  | 'WORKING'
  | 'LEFT'
  | 'ANNUAL'
  | 'OFF'
  | 'REMOTE'
  | 'WEEKEND'
  | 'DAY_OFF'
  | 'ABSENT'

export interface AuthUser {
  id: number
  loginId: string
  name: string
  role: Role
  hireDate: string
}

export interface Me {
  user: AuthUser
  ip: string
  isLabIp: boolean
}

export interface Attendance {
  id: number
  userId: number
  userName?: string
  workDate: string
  workType: WorkType
  clockIn: string
  clockOut: string | null
  clockOutManual: boolean
  isLate: boolean
  isEarlyLeave: boolean
  workMinutes: number | null
}

export interface Balances {
  annual: { accrued: number; used: number; remaining: number }
  remote: { month: string; limit: number; used: number; remaining: number }
  off: { remaining: number; nextExpires: string | null }
}

export interface ApplicationSummary {
  id: number
  type: ApplicationType
  status: ApplicationStatus
  ip: string | null
  startTime: string | null
  endTime: string | null
}

export interface MyCard {
  now: string
  today: string
  isBusinessDay: boolean
  holidayName: string | null
  attendance: Attendance | null
  applications: ApplicationSummary[]
  balances: Balances
}

export interface BoardMember {
  userId: number
  name: string
  role: Role
  status: BoardStatus
  workType: WorkType | null
  applied: ApplicationType[]
  clockIn: string | null
  clockOut: string | null
  isLate: boolean
  isEarlyLeave: boolean
}

export interface TeamBoard {
  today: string
  isBusinessDay: boolean
  members: BoardMember[]
}

export interface Issues {
  missing: Attendance[]
  manual: Attendance[]
}

export interface Application {
  id: number
  userId: number
  userName: string
  type: ApplicationType
  targetDate: string
  reason: string | null
  ip: string | null
  startTime: string | null
  endTime: string | null
  status: ApplicationStatus
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
  deadline: string
  canCancel: boolean
  canDecide: boolean
}

export interface SettlementRow {
  userId: number
  name: string
  role: Role
  workDays: number
  weekendWorkDays: number
  remoteDays: number
  workMinutes: number
  lateCount: number
  earlyLeaveCount: number
  manualCount: number
  missingCount: number
  balances: { annual: number; remote: number; off: number }
}

export interface Settlement {
  month: string
  asOf: string
  rows: SettlementRow[]
}

export type LogCategory = 'ACCESS' | 'CLOCK' | 'APPLICATION' | 'SETTINGS'

export interface AllowedIp {
  id: number
  ip: string
  label: string | null
  /** 지금 이 화면에 접속 중인 IP */
  current: boolean
}

export interface LogEntry {
  id: number
  action: string
  category: LogCategory | null
  userId: number | null
  userName: string | null
  ip: string | null
  detail: unknown
  createdAt: string
}

export interface Holiday {
  date: string
  name: string
}
