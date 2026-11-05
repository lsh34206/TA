import type {
  ApplicationStatus,
  ApplicationType,
  BoardStatus,
  LogCategory,
  Role,
  WorkType,
} from '../api/types'

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'gray'

export const ROLE_LABEL: Record<Role, string> = { MEMBER: '팀원', LEAD: '리드' }

export const TYPE_LABEL: Record<ApplicationType, string> = {
  ANNUAL: '연차',
  REMOTE: '재택',
  OFF: '반일 OFF',
  WEEKEND_WORK: '주말·공휴일 근무',
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
}

export const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'danger',
  CANCELLED: 'gray',
}

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  OFFICE: '사무실',
  REMOTE: '재택',
  WEEKEND_WORK: '휴일 근무',
}

export const BOARD_STATUS: Record<BoardStatus, { label: string; tone: Tone }> = {
  WORKING: { label: '근무 중', tone: 'ok' },
  LEFT: { label: '퇴근', tone: 'gray' },
  ANNUAL: { label: '연차', tone: 'info' },
  OFF: { label: 'OFF (출근 전)', tone: 'info' },
  REMOTE: { label: '재택 (출근 전)', tone: 'info' },
  WEEKEND: { label: '휴일 근무 (출근 전)', tone: 'info' },
  DAY_OFF: { label: '휴무', tone: 'gray' },
  ABSENT: { label: '미출근', tone: 'danger' },
}

export const ACTION_LABEL: Record<string, string> = {
  LOGIN: '로그인',
  LOGIN_FAILED: '로그인 실패',
  LOGIN_LOCKED: '로그인 잠금',
  ACCESS_DENIED: '접속 차단',
  CLOCK_IN: '출근',
  CLOCK_OUT: '퇴근',
  CLOCK_OUT_MANUAL: '퇴근 직접 입력',
  APPLICATION_CREATE: '신청',
  APPLICATION_CANCEL: '신청 취소',
  APPLICATION_APPROVE: '신청 승인',
  APPLICATION_REJECT: '신청 반려',
  APPLICATION_PDF: '신청서 PDF',
  HOLIDAY_ADD: '공휴일 등록',
  HOLIDAY_REMOVE: '공휴일 삭제',
  IP_ADD: '접속 IP 등록',
  IP_UPDATE: '접속 IP 수정',
  IP_REMOVE: '접속 IP 삭제',
}

export const CATEGORY_LABEL: Record<LogCategory, string> = {
  ACCESS: '접속',
  CLOCK: '출퇴근',
  APPLICATION: '신청',
  SETTINGS: '설정',
}

export const CATEGORY_TONE: Record<LogCategory, Tone> = {
  ACCESS: 'gray',
  CLOCK: 'ok',
  APPLICATION: 'info',
  SETTINGS: 'warn',
}

/** 분류와 상관없이 눈에 띄어야 하는 동작 */
export const ALERT_ACTIONS = ['LOGIN_FAILED', 'LOGIN_LOCKED', 'ACCESS_DENIED']
