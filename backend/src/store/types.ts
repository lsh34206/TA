// 로컬 JSON 저장소의 레코드 타입. 날짜는 'YYYY-MM-DD', 시각은 ISO 8601 문자열로 저장한다.

export const Role = { MEMBER: 'MEMBER', LEAD: 'LEAD' } as const;
export type Role = (typeof Role)[keyof typeof Role];

/** 신청 종류: 연차 / 재택 / 반일 OFF / 주말·공휴일 근무 */
export const ApplicationType = {
  ANNUAL: 'ANNUAL',
  REMOTE: 'REMOTE',
  OFF: 'OFF',
  WEEKEND_WORK: 'WEEKEND_WORK',
} as const;
export type ApplicationType = (typeof ApplicationType)[keyof typeof ApplicationType];

/** PENDING(승인 대기)도 신청 효력은 유효하다. 리드가 반려하면 REJECTED로 무효가 된다. */
export const ApplicationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const WorkType = {
  OFFICE: 'OFFICE',
  REMOTE: 'REMOTE',
  WEEKEND_WORK: 'WEEKEND_WORK',
} as const;
export type WorkType = (typeof WorkType)[keyof typeof WorkType];

export interface User {
  id: number;
  loginId: string;
  passwordHash: string;
  name: string;
  role: Role;
  hireDate: string;
  createdAt: string;
}

/** 연구실 IP (상시 허용) */
export interface AllowedIp {
  id: number;
  ip: string;
  label: string | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface Attendance {
  id: number;
  userId: number;
  workDate: string;
  workType: WorkType;
  clockIn: string;
  clockInIp: string;
  clockOut: string | null;
  clockOutIp: string | null;
  /** 퇴근을 찍지 않아 다음 출근 때 직접 입력한 경우 */
  clockOutManual: boolean;
  isLate: boolean;
  isEarlyLeave: boolean;
  workMinutes: number | null;
}

export interface Application {
  id: number;
  userId: number;
  type: ApplicationType;
  targetDate: string;
  reason: string | null;
  /** 재택·주말/공휴일 근무: 허용 IP와 시간대('HH:mm') */
  ip: string | null;
  startTime: string | null;
  endTime: string | null;
  status: ApplicationStatus;
  decidedById: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

/** 주말·공휴일 근무로 지급되는 반일 OFF. 지급일로부터 30일 안에 사용해야 한다. */
export interface OffGrant {
  id: number;
  userId: number;
  attendanceId: number;
  grantedDate: string;
  expiresDate: string;
  usedByApplicationId: number | null;
}

export interface ActivityLog {
  id: number;
  userId: number | null;
  action: string;
  ip: string | null;
  detail: unknown;
  createdAt: string;
}
