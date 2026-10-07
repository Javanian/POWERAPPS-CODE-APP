import { useMemo, useState } from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { EmptyState } from '../components/ui'
import { MAX_HOURS_PER_WEEK, formatHours, monthlyRecap, recapToCsv, type OvertimeRequest } from '../domain/overtime'
import { formatMonth, initials, todayIso } from '../format'

export function RecapPage({ requests }: { requests: OvertimeRequest[] }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7))
  const rows = useMemo(() => monthlyRecap(requests, month), [requests, month])
  const totalHours = rows.reduce((total, row) => total + row.hours, 0)
  const maxHours = Math.max(1, ...rows.map((row) => row.hours))

  function exportCsv() {
    const blob = new Blob([`\ufeff${recapToCsv(rows, month)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rekap-lembur-${month}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Rekap lembur</h1>
          <p>Lembur yang sudah disetujui per karyawan, siap diekspor untuk payroll.</p>
        </div>
        <div className="head-actions">
          <input
            className="input input-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Bulan"
          />
          <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={16} aria-hidden="true" />
            Ekspor CSV
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span>Periode</span>
          <strong>{formatMonth(month)}</strong>
        </div>
        <div className="stat">
          <span>Total jam lembur</span>
          <strong>{formatHours(totalHours)}</strong>
        </div>
        <div className="stat">
          <span>Karyawan</span>
          <strong>{rows.length}</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada lembur disetujui" description="Pilih bulan lain atau tunggu SPL disetujui." />
      ) : (
        <div className="table-card">
          <table className="recap-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Departemen</th>
                <th className="num">SPL</th>
                <th>Total jam</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.nik}>
                  <td>
                    <span className="person">
                      <span className="avatar">{initials(row.name)}</span>
                      <span>
                        <strong>{row.name}</strong>
                        <small>NIK {row.nik}</small>
                      </span>
                    </span>
                  </td>
                  <td>{row.department}</td>
                  <td className="num">{row.sessions}</td>
                  <td>
                    <span className="hours-cell">
                      <span className="hours-bar" aria-hidden="true">
                        <span style={{ width: `${(row.hours / maxHours) * 100}%` }} />
                      </span>
                      <strong>{formatHours(row.hours)}</strong>
                      {row.maxWeekHours > MAX_HOURS_PER_WEEK ? (
                        <span className="flag" title={`Pernah melebihi ${MAX_HOURS_PER_WEEK} jam dalam seminggu`}>
                          <TriangleAlert size={14} aria-hidden="true" />
                          &gt;{MAX_HOURS_PER_WEEK} jam/minggu
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
