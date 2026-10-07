import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { RequestCard } from '../components/RequestCard'
import { EmptyState } from '../components/ui'
import { durationHours, formatHours, weekStart, type OvertimeRequest, type OvertimeStatus } from '../domain/overtime'
import { todayIso } from '../format'

const filters: { value: OvertimeStatus | null; label: string }[] = [
  { value: null, label: 'Semua' },
  { value: 'Pending', label: 'Menunggu' },
  { value: 'Approved', label: 'Disetujui' },
  { value: 'Rejected', label: 'Ditolak' },
]

export function RequestsPage({ requests, onCreate }: { requests: OvertimeRequest[]; onCreate: () => void }) {
  const [status, setStatus] = useState<OvertimeStatus | null>(null)

  const stats = useMemo(() => {
    const thisWeek = weekStart(todayIso())
    const week = requests.filter((request) => weekStart(request.workDate) === thisWeek && request.status !== 'Rejected')
    const personHours = week.reduce(
      (total, request) => total + durationHours(request.startTime, request.endTime) * request.employees.length,
      0,
    )
    const people = new Set(week.flatMap((request) => request.employees.map((employee) => employee.nik)))
    return {
      pending: requests.filter((request) => request.status === 'Pending').length,
      personHours,
      people: people.size,
    }
  }, [requests])

  const visible = status ? requests.filter((request) => request.status === status) : requests

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Pengajuan lembur</h1>
          <p>Buat SPL untuk tim Anda. Atasan menyetujui dari aplikasi, HR langsung mendapat rekapnya.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          <Plus size={16} aria-hidden="true" />
          Buat SPL
        </button>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span>Menunggu persetujuan</span>
          <strong>{stats.pending}</strong>
        </div>
        <div className="stat">
          <span>Total jam lembur tim minggu ini</span>
          <strong>{formatHours(stats.personHours)}</strong>
        </div>
        <div className="stat">
          <span>Karyawan lembur minggu ini</span>
          <strong>{stats.people}</strong>
        </div>
      </div>

      <div className="chip-row" role="group" aria-label="Filter status">
        {filters.map((filter) => {
          const count = filter.value ? requests.filter((request) => request.status === filter.value).length : requests.length
          return (
            <button
              key={filter.label}
              type="button"
              className={`chip ${status === filter.value ? 'chip-active' : ''}`}
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
              <span className="chip-count">{count}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Belum ada SPL"
          description="Lembur yang Anda ajukan akan muncul di sini."
          action={
            <button type="button" className="btn btn-secondary" onClick={onCreate}>
              Buat SPL pertama
            </button>
          }
        />
      ) : (
        <div className="card-list">
          {visible.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  )
}
