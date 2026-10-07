import type { ReactNode } from 'react'
import type { OvertimeEmployee, OvertimeStatus } from '../domain/overtime'
import { initials } from '../format'

const statusLabel: Record<OvertimeStatus, string> = {
  Pending: 'Menunggu',
  Approved: 'Disetujui',
  Rejected: 'Ditolak',
}

export function StatusBadge({ status }: { status: OvertimeStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{statusLabel[status]}</span>
}

export function AvatarStack({ employees, max = 4 }: { employees: OvertimeEmployee[]; max?: number }) {
  const shown = employees.slice(0, max)
  const rest = employees.length - shown.length

  return (
    <span className="avatar-stack" aria-label={employees.map((employee) => employee.name).join(', ')}>
      {shown.map((employee) => (
        <span key={employee.nik} className="avatar" title={employee.name}>
          {initials(employee.name)}
        </span>
      ))}
      {rest > 0 ? <span className="avatar avatar-more">+{rest}</span> : null}
    </span>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-emoji" aria-hidden="true">
        ☕
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}
