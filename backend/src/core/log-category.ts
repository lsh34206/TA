import type { LogAction } from './activity-log.service.js';

/** 이력 화면의 분류 */
export const LOG_CATEGORIES = ['ACCESS', 'CLOCK', 'APPLICATION', 'SETTINGS'] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

/** 동작 → 분류. LogAction에 동작을 추가하면 여기서도 분류를 정해야 컴파일된다. */
export const ACTION_CATEGORY: Record<LogAction, LogCategory> = {
  LOGIN: 'ACCESS',
  LOGIN_FAILED: 'ACCESS',
  LOGIN_LOCKED: 'ACCESS',
  ACCESS_DENIED: 'ACCESS',
  CLOCK_IN: 'CLOCK',
  CLOCK_OUT: 'CLOCK',
  CLOCK_OUT_MANUAL: 'CLOCK',
  APPLICATION_CREATE: 'APPLICATION',
  APPLICATION_CANCEL: 'APPLICATION',
  APPLICATION_APPROVE: 'APPLICATION',
  APPLICATION_REJECT: 'APPLICATION',
  APPLICATION_PDF: 'APPLICATION',
  HOLIDAY_ADD: 'SETTINGS',
  HOLIDAY_REMOVE: 'SETTINGS',
  IP_ADD: 'SETTINGS',
  IP_UPDATE: 'SETTINGS',
  IP_REMOVE: 'SETTINGS',
};

/** 파일을 손으로 고쳐 알 수 없는 동작이 들어 있으면 null */
export const categoryOf = (action: string): LogCategory | null =>
  (ACTION_CATEGORY as Record<string, LogCategory | undefined>)[action] ?? null;
