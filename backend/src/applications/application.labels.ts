import type { ApplicationStatus, ApplicationType } from '../store/types.js';

export const TYPE_LABEL: Record<ApplicationType, string> = {
  ANNUAL: '연차',
  REMOTE: '재택근무',
  OFF: '반일 OFF',
  WEEKEND_WORK: '주말·공휴일 근무',
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};
