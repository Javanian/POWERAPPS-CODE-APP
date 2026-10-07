import { describe, expect, it } from 'vitest'
import {
  durationHours,
  formatHours,
  monthlyRecap,
  recapToCsv,
  validateDraft,
  weekStart,
  type OvertimeRequest,
} from './overtime'

const andi = { nik: '10231', name: 'Andi Saputra', department: 'Produksi' }
const budi = { nik: '10877', name: 'Budi, S.T.', department: 'Produksi' }

function request(overrides: Partial<OvertimeRequest>): OvertimeRequest {
  return {
    id: 1,
    number: 'SPL-1',
    workDate: '2026-10-05',
    shift: '1',
    startTime: '15:00',
    endTime: '18:00',
    department: 'Produksi',
    reason: 'Kejar target',
    employees: [andi],
    status: 'Approved',
    requestedBy: 'Supervisor',
    requestedAt: '2026-10-05T08:00:00Z',
    decidedBy: '',
    decidedAt: '',
    decisionNote: '',
    ...overrides,
  }
}

describe('durationHours', () => {
  it('counts a same-day window', () => {
    expect(durationHours('15:00', '18:30')).toBe(3.5)
  })

  it('crosses midnight when the end is before the start', () => {
    expect(durationHours('23:00', '02:00')).toBe(3)
  })

  it('returns 0 for invalid or equal times', () => {
    expect(durationHours('25:00', '02:00')).toBe(0)
    expect(durationHours('10:00', '10:00')).toBe(0)
  })
})

describe('weekStart', () => {
  it('maps any day to the Monday of its week', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05')
    expect(weekStart('2026-10-11')).toBe('2026-10-05')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
  })
})

describe('validateDraft', () => {
  const draft = { workDate: '2026-10-07', startTime: '15:00', endTime: '18:00', reason: 'Kejar target', employees: [andi] }

  it('accepts a valid draft', () => {
    expect(validateDraft(draft, [])).toEqual([])
  })

  it('rejects more than 4 hours per day', () => {
    const issues = validateDraft({ ...draft, endTime: '20:00' }, [])
    expect(issues.some((issue) => issue.level === 'error' && issue.message.includes('4 jam'))).toBe(true)
  })

  it('warns when the weekly total would exceed 18 hours', () => {
    const existing = [1, 2, 3, 4].map((day) =>
      request({ id: day, workDate: `2026-10-0${4 + day}`, startTime: '15:00', endTime: '19:00' }),
    )
    const issues = validateDraft({ ...draft, workDate: '2026-10-10' }, existing)
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning' }))
  })

  it('ignores rejected requests in the weekly total', () => {
    const existing = [1, 2, 3, 4].map((day) =>
      request({ id: day, workDate: `2026-10-0${4 + day}`, startTime: '15:00', endTime: '19:00', status: 'Rejected' }),
    )
    expect(validateDraft({ ...draft, workDate: '2026-10-10' }, existing)).toEqual([])
  })
})

describe('monthlyRecap', () => {
  it('sums approved hours per employee for the month only', () => {
    const rows = monthlyRecap(
      [
        request({ id: 1, employees: [andi, budi] }),
        request({ id: 2, workDate: '2026-10-06', employees: [andi], endTime: '17:00' }),
        request({ id: 3, status: 'Pending' }),
        request({ id: 4, workDate: '2026-09-30' }),
      ],
      '2026-10',
    )
    expect(rows).toEqual([
      expect.objectContaining({ nik: '10231', sessions: 2, hours: 5, maxWeekHours: 5 }),
      expect.objectContaining({ nik: '10877', sessions: 1, hours: 3 }),
    ])
  })

  it('exports quoted CSV', () => {
    const csv = recapToCsv(monthlyRecap([request({ employees: [budi] })], '2026-10'), '2026-10')
    expect(csv.split('\r\n')[1]).toBe('"2026-10","10877","Budi, S.T.","Produksi","1","3.00"')
  })
})

describe('formatHours', () => {
  it('formats hours and minutes', () => {
    expect(formatHours(3)).toBe('3 jam')
    expect(formatHours(2.5)).toBe('2 jam 30 mnt')
    expect(formatHours(0.25)).toBe('15 mnt')
  })
})
