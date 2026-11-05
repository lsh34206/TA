import type { Attendance } from '../store/types.js';

export const toAttendanceDto = (a: Attendance, userName?: string) => ({
  id: a.id,
  userId: a.userId,
  userName,
  workDate: a.workDate,
  workType: a.workType,
  clockIn: a.clockIn,
  clockOut: a.clockOut,
  clockOutManual: a.clockOutManual,
  isLate: a.isLate,
  isEarlyLeave: a.isEarlyLeave,
  workMinutes: a.workMinutes,
});

export type AttendanceDto = ReturnType<typeof toAttendanceDto>;
