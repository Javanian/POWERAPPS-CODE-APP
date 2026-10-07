import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Search, TriangleAlert, X } from 'lucide-react'
import type { NewRequest } from '../data/overtimeRepository'
import {
  durationHours,
  formatHours,
  shiftDefaults,
  validateDraft,
  type OvertimeEmployee,
  type OvertimeRequest,
  type Shift,
} from '../domain/overtime'
import { initials, todayIso } from '../format'

type Props = {
  employees: OvertimeEmployee[]
  existing: OvertimeRequest[]
  onClose: () => void
  onSubmit: (draft: NewRequest) => Promise<void>
}

export function NewRequestPanel({ employees, existing, onClose, onSubmit }: Props) {
  const [draft, setDraft] = useState<NewRequest>({
    workDate: todayIso(),
    shift: '1',
    startTime: shiftDefaults['1'].start,
    endTime: shiftDefaults['1'].end,
    department: '',
    reason: '',
    employees: [],
  })
  const [query, setQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hours = durationHours(draft.startTime, draft.endTime)
  const issues = useMemo(() => validateDraft(draft, existing), [draft, existing])
  const errors = issues.filter((issue) => issue.level === 'error')
  const warnings = issues.filter((issue) => issue.level === 'warning')

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    const selected = new Set(draft.employees.map((employee) => employee.nik))
    return employees
      .filter((employee) => !selected.has(employee.nik))
      .filter((employee) => `${employee.name} ${employee.nik} ${employee.department}`.toLowerCase().includes(term))
      .slice(0, 6)
  }, [employees, draft.employees, query])

  function update<K extends keyof NewRequest>(key: K, value: NewRequest[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function chooseShift(shift: Shift) {
    setDraft((current) => ({ ...current, shift, startTime: shiftDefaults[shift].start, endTime: shiftDefaults[shift].end }))
  }

  function addEmployee(employee: OvertimeEmployee) {
    setDraft((current) => ({
      ...current,
      employees: [...current.employees, employee],
      department: current.department || employee.department,
    }))
    setQuery('')
  }

  function removeEmployee(nik: string) {
    update('employees', draft.employees.filter((employee) => employee.nik !== nik))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (errors.length > 0) return
    setIsSaving(true)
    setSubmitError(null)
    try {
      await onSubmit(draft)
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : 'SPL belum bisa disimpan.')
      setIsSaving(false)
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-request-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <header className="sheet-head">
          <div>
            <h2 id="new-request-title">Buat SPL</h2>
            <p>Surat perintah lembur untuk tim Anda.</p>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>

        <div className="sheet-body">
          <label className="field">
            <span>Tanggal lembur</span>
            <input className="input" type="date" value={draft.workDate} onChange={(event) => update('workDate', event.target.value)} />
          </label>

          <div className="field">
            <span>Shift</span>
            <div className="segmented" role="radiogroup" aria-label="Shift">
              {(Object.keys(shiftDefaults) as Shift[]).map((shift) => (
                <button
                  key={shift}
                  type="button"
                  role="radio"
                  aria-checked={draft.shift === shift}
                  className={draft.shift === shift ? 'segment segment-active' : 'segment'}
                  onClick={() => chooseShift(shift)}
                >
                  Shift {shift}
                </button>
              ))}
            </div>
            <small className="hint">{shiftDefaults[draft.shift].label}</small>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Mulai</span>
              <input className="input" type="time" value={draft.startTime} onChange={(event) => update('startTime', event.target.value)} />
            </label>
            <label className="field">
              <span>Selesai</span>
              <input className="input" type="time" value={draft.endTime} onChange={(event) => update('endTime', event.target.value)} />
            </label>
            <div className="duration-pill" aria-live="polite">
              <span>Durasi</span>
              <strong>{hours > 0 ? formatHours(hours) : '–'}</strong>
            </div>
          </div>

          <div className="field">
            <span>Karyawan</span>
            <div className="search-input">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama, NIK, atau departemen"
                aria-label="Cari karyawan"
              />
            </div>
            {matches.length > 0 ? (
              <ul className="suggestions" role="listbox" aria-label="Hasil pencarian karyawan">
                {matches.map((employee) => (
                  <li key={employee.nik}>
                    <button type="button" onClick={() => addEmployee(employee)}>
                      <span className="avatar">{initials(employee.name)}</span>
                      <span>
                        <strong>{employee.name}</strong>
                        <small>
                          NIK {employee.nik} · {employee.department}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {draft.employees.length > 0 ? (
              <div className="selected-people">
                {draft.employees.map((employee) => (
                  <span key={employee.nik} className="person-chip">
                    <span className="avatar">{initials(employee.name)}</span>
                    {employee.name}
                    <button type="button" onClick={() => removeEmployee(employee.nik)} aria-label={`Hapus ${employee.name}`}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <label className="field">
            <span>Alasan lembur</span>
            <textarea
              className="input"
              rows={3}
              value={draft.reason}
              onChange={(event) => update('reason', event.target.value)}
              placeholder="Contoh: Kejar target order PO-2291 sebelum pengiriman Jumat"
            />
          </label>

          {warnings.map((issue) => (
            <p key={issue.message} className="notice notice-warning">
              <TriangleAlert size={16} aria-hidden="true" />
              {issue.message}
            </p>
          ))}
          {showErrors
            ? errors.map((issue) => (
                <p key={issue.message} className="notice notice-error">
                  <AlertCircle size={16} aria-hidden="true" />
                  {issue.message}
                </p>
              ))
            : null}
          {submitError ? (
            <p className="notice notice-error">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </p>
          ) : null}
        </div>

        <footer className="sheet-foot">
          <span className="summary">
            {draft.employees.length} orang × {hours > 0 ? formatHours(hours) : '0 jam'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Mengirim…' : 'Kirim untuk persetujuan'}
          </button>
        </footer>
      </form>
    </div>
  )
}
