import type { ReactNode } from 'react'
import { Clock, Users } from 'lucide-react'
import { durationHours, formatHours, type OvertimeRequest } from '../domain/overtime'
import { dayParts } from '../format'
import { AvatarStack, StatusBadge } from './ui'

export function RequestCard({ request, children }: { request: OvertimeRequest; children?: ReactNode }) {
  const hours = durationHours(request.startTime, request.endTime)
  const { day, month } = dayParts(request.workDate)

  return (
    <article className="request-card">
      <div className="date-block" aria-hidden="true">
        <span>{month}</span>
        <strong>{day}</strong>
      </div>

      <div className="request-main">
        <div className="request-top">
          <span className="request-number">{request.number}</span>
          <StatusBadge status={request.status} />
        </div>
        <h3>{request.reason}</h3>
        <div className="request-meta">
          <span className="time-chip">
            <Clock size={14} aria-hidden="true" />
            {request.startTime}–{request.endTime} · {formatHours(hours)}
          </span>
          <span>
            <Users size={14} aria-hidden="true" />
            {request.employees.length} orang · {request.department}
          </span>
          <span>Oleh {request.requestedBy}</span>
        </div>
        {request.status === 'Rejected' && request.decisionNote ? (
          <p className="decision-note">Alasan ditolak: {request.decisionNote}</p>
        ) : null}
      </div>

      <AvatarStack employees={request.employees} />
      {children ? <div className="request-actions">{children}</div> : null}
    </article>
  )
}
