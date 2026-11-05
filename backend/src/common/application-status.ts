import type { ApplicationStatus } from '../store/types.js';

/** 신청 효력이 살아 있는 상태. 승인 전(PENDING)에도 유효하고, 반려·취소되면 무효가 된다. */
export const VALID_STATUSES: ApplicationStatus[] = ['PENDING', 'APPROVED'];
