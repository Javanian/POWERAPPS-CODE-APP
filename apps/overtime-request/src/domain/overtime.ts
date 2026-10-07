// Overtime rules and calculations. Pure functions, no SDK access, so they can be unit tested.

export type OvertimeStatus = 'Pending' | 'Approved' | 'Rejected'

export type Shift = '1' | '2' | '3'

export type OvertimeEmployee = {
  nik: string
  name: string
  department: string
}

export type OvertimeRequest = {
  id: number
  number: string
  workDate: string // yyyy-mm-dd
  shift: Shift
  startTime: string // HH:mm
  endTime: string // HH:mm
  department: string
  reason: string
  employees: OvertimeEmployee[]
  status: OvertimeStatus
  requestedBy: string
  requestedAt: string
  decidedBy: string
  decidedAt: string
  decisionNote: string
}

/** Indonesian limit for overtime on a working day (PP 35/2021, art. 26). */
export const MAX_HOURS_PER_DAY = 4
/** Indonesian weekly overtime limit (PP 35/2021, art. 26). */
export const MAX_HOURS_PER_WEEK = 18

/** Typical overtime window right after each shift ends. */
export const shiftDefaults: Record<Shift, { label: string; start: string; end: string }> = {
  '1': { label: 'Shift 1 (07:00–15:00)', start: '15:00', end: '18:00' },
  '2': { label: 'Shift 2 (15:00–23:00)', start: '23:00', end: '02:00' },
  '3': { label: 'Shift 3 (23:00–07:00)', start: '07:00', end: '10:00' },
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Duration in hours between two clock times; an end before the start crosses midnight. */
export function durationHours(startTime: string, endTime: string): number {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null || start === end) return 0
  const minutes = end > start ? end - start : 24 * 60 - start + end
  return Math.round((minutes / 60) * 100) / 100
}

/** Monday-based week key, e.g. "2026-10-05" for any date in that week. */
export function weekStart(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = (date.getUTCDay() + 6) % 7 // Monday = 0
  date.setUTCDate(date.getUTCDate() - weekday)
  return date.toISOString().slice(0, 10)
}

export type ValidationIssue = { level: 'error' | 'warning'; message: string }

export type DraftRequest = Pick<OvertimeRequest, 'workDate' | 'startTime' | 'endTime' | 'reason' | 'employees'>

/**
 * Checks a draft against the daily limit, required fields, and each employee's
 * hours already approved or pending in the same week.
 */
export function validateDraft(draft: DraftRequest, existing: OvertimeRequest[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const hours = durationHours(draft.startTime, draft.endTime)

  if (!draft.workDate) issues.push({ level: 'error', message: 'Pilih tanggal lembur.' })
  if (hours <= 0) issues.push({ level: 'error', message: 'Jam selesai harus berbeda dari jam mulai.' })
  if (hours > MAX_HOURS_PER_DAY) {
    issues.push({
      level: 'error',
      message: `Durasi ${formatHours(hours)} melebihi batas ${MAX_HOURS_PER_DAY} jam per hari.`,
    })
  }
  if (draft.employees.length === 0) issues.push({ level: 'error', message: 'Tambahkan minimal satu karyawan.' })
  if (draft.reason.trim().length < 5) issues.push({ level: 'error', message: 'Tuliskan alasan lembur.' })

  if (draft.workDate && hours > 0) {
    const week = weekStart(draft.workDate)
    const weekly = weeklyHoursByEmployee(existing.filter((request) => request.status !== 'Rejected'), week)

    for (const employee of draft.employees) {
      const total = (weekly.get(employee.nik) ?? 0) + hours
      if (total > MAX_HOURS_PER_WEEK) {
        issues.push({
          level: 'warning',
          message: `${employee.name} akan lembur ${formatHours(total)} minggu ini (batas ${MAX_HOURS_PER_WEEK} jam).`,
        })
      }
    }
  }

  return issues
}

/** Total hours per employee (by NIK) for requests in the given week. */
export function weeklyHoursByEmployee(requests: OvertimeRequest[], week: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const request of requests) {
    if (weekStart(request.workDate) !== week) continue
    const hours = durationHours(request.startTime, request.endTime)
    for (const employee of request.employees) {
      totals.set(employee.nik, (totals.get(employee.nik) ?? 0) + hours)
    }
  }
  return totals
}

export type RecapRow = {
  nik: string
  name: string
  department: string
  sessions: number
  hours: number
  maxWeekHours: number
}

/** Approved overtime per employee for a month ("yyyy-mm"), sorted by hours. */
export function monthlyRecap(requests: OvertimeRequest[], month: string): RecapRow[] {
  const rows = new Map<string, RecapRow>()
  const weekTotals = new Map<string, number>()

  for (const request of requests) {
    if (request.status !== 'Approved' || !request.workDate.startsWith(month)) continue
    const hours = durationHours(request.startTime, request.endTime)
    const week = weekStart(request.workDate)

    for (const employee of request.employees) {
      const row = rows.get(employee.nik) ?? {
        nik: employee.nik,
        name: employee.name,
        department: employee.department,
        sessions: 0,
        hours: 0,
        maxWeekHours: 0,
      }
      row.sessions += 1
      row.hours += hours

      const weekKey = `${employee.nik}|${week}`
      const weekHours = (weekTotals.get(weekKey) ?? 0) + hours
      weekTotals.set(weekKey, weekHours)
      row.maxWeekHours = Math.max(row.maxWeekHours, weekHours)

      rows.set(employee.nik, row)
    }
  }

  return [...rows.values()].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
}

/** CSV for payroll import; values are quoted so names with commas stay intact. */
export function recapToCsv(rows: RecapRow[], month: string): string {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const header = ['Bulan', 'NIK', 'Nama', 'Departemen', 'Jumlah SPL', 'Total Jam']
  const lines = rows.map((row) =>
    [month, row.nik, row.name, row.department, row.sessions, row.hours.toFixed(2)].map(quote).join(','),
  )
  return [header.map(quote).join(','), ...lines].join('\r\n')
}

export function formatHours(hours: number): string {
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (minutes === 0) return `${whole} jam`
  if (whole === 0) return `${minutes} mnt`
  return `${whole} jam ${minutes} mnt`
}
