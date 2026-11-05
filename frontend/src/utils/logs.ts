import type { ApplicationType, LogEntry, WorkType } from '../api/types'
import { fmtDate, fmtMinutes } from './format'
import { TYPE_LABEL, WORK_TYPE_LABEL } from './labels'

type Detail = Record<string, unknown>

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null)
const num = (value: unknown) => (typeof value === 'number' ? value : null)
const date = (value: unknown) => {
  const v = text(value)
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : (v ?? '-')
}
const withLabel = (ip: unknown, label: unknown) => {
  const l = text(label)
  return `${text(ip) ?? '-'}${l ? ` (${l})` : ''}`
}

/**
 * 이력 한 줄에 보여 줄 설명. 서버가 남긴 상세(detail)를 사람이 읽는 문장으로 바꾼다.
 * `nameOf`로 사용자 id를 이름으로 바꿀 수 있다.
 */
export function describeLog(log: LogEntry, nameOf: (id: number) => string | null = () => null): string {
  const d: Detail = log.detail && typeof log.detail === 'object' ? (log.detail as Detail) : {}
  const appNo = num(d.applicationId) !== null ? `#${d.applicationId}` : ''

  switch (log.action) {
    case 'LOGIN':
      return '로그인했습니다.'
    case 'LOGIN_FAILED':
      return `아이디 '${text(d.loginId) ?? '-'}'로 로그인에 실패했습니다.`
    case 'LOGIN_LOCKED':
      return `아이디 '${text(d.loginId) ?? '-'}'의 로그인 시도가 너무 많아 10분간 잠겼습니다.`
    case 'ACCESS_DENIED':
      return `등록되지 않은 IP이거나 허용 시간대가 아니라 접속이 차단됐습니다. (${text(d.path) ?? '-'})`

    case 'CLOCK_IN': {
      const where = WORK_TYPE_LABEL[d.workType as WorkType] ?? ''
      return `${where ? `${where} ` : ''}출근${d.isLate ? ' · 지각' : ''}`
    }
    case 'CLOCK_OUT': {
      const minutes = num(d.workMinutes)
      return `퇴근${minutes !== null ? ` · 근무 ${fmtMinutes(minutes)}` : ''}${d.isEarlyLeave ? ' · 조퇴' : ''}`
    }
    case 'CLOCK_OUT_MANUAL': {
      const minutes = num(d.workMinutes)
      return `${date(d.workDate)} 퇴근 시각을 ${text(d.time) ?? '-'}로 직접 입력${
        minutes !== null ? ` · 근무 ${fmtMinutes(minutes)}` : ''
      }`
    }

    case 'APPLICATION_CREATE':
      return `${TYPE_LABEL[d.type as ApplicationType] ?? '-'} 신청 · ${date(d.targetDate)} ${appNo}`.trim()
    case 'APPLICATION_CANCEL':
      return `신청 ${appNo} 취소`
    case 'APPLICATION_APPROVE':
    case 'APPLICATION_REJECT': {
      const who = num(d.applicantId) !== null ? nameOf(d.applicantId as number) : null
      const verdict = log.action === 'APPLICATION_APPROVE' ? '승인' : '반려'
      const note = text(d.note)
      return `${who ? `${who} 님의 ` : ''}신청 ${appNo} ${verdict}${note ? ` · ${note}` : ''}`
    }
    case 'APPLICATION_PDF':
      return `신청서 ${appNo} PDF 내려받기`

    case 'HOLIDAY_ADD':
      return `${date(d.date)} ${text(d.name) ?? ''} 등록`.replace('  ', ' ')
    case 'HOLIDAY_REMOVE':
      return `${date(d.date)} 공휴일 삭제`

    case 'IP_ADD':
      return `${withLabel(d.ip, d.label)} 등록`
    case 'IP_UPDATE':
      return `${text(d.ip) ?? '-'} 이름을 ${text(d.label) ? `'${text(d.label)}'로 변경` : '삭제'}`
    case 'IP_REMOVE':
      return `${withLabel(d.ip, d.label)} 삭제`

    default:
      return Object.entries(d)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ')
  }
}
