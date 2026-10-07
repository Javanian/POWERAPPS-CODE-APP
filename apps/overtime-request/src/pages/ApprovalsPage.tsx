import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { RequestCard } from '../components/RequestCard'
import { EmptyState } from '../components/ui'
import { durationHours, formatHours, type OvertimeRequest } from '../domain/overtime'

type Decide = (request: OvertimeRequest, status: 'Approved' | 'Rejected', note: string) => Promise<void>

export function ApprovalsPage({ requests, onDecide }: { requests: OvertimeRequest[]; onDecide: Decide }) {
  const pending = requests.filter((request) => request.status === 'Pending')
  const totalPersonHours = pending.reduce(
    (total, request) => total + durationHours(request.startTime, request.endTime) * request.employees.length,
    0,
  )

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Persetujuan</h1>
          <p>
            {pending.length > 0
              ? `${pending.length} SPL menunggu keputusan Anda, total ${formatHours(totalPersonHours)} lembur untuk seluruh karyawan.`
              : 'Tidak ada SPL yang menunggu keputusan.'}
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <EmptyState title="Semua beres" description="SPL baru dari supervisor akan muncul di sini." />
      ) : (
        <div className="card-list">
          {pending.map((request) => (
            <RequestCard key={request.id} request={request}>
              <DecisionBar request={request} onDecide={onDecide} />
            </RequestCard>
          ))}
        </div>
      )}
    </section>
  )
}

function DecisionBar({ request, onDecide }: { request: OvertimeRequest; onDecide: Decide }) {
  const [isRejecting, setIsRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function decide(status: 'Approved' | 'Rejected') {
    setIsSaving(true)
    try {
      await onDecide(request, status, note)
    } finally {
      setIsSaving(false)
    }
  }

  if (isRejecting) {
    return (
      <div className="decision-bar decision-bar-reject">
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Alasan penolakan (wajib)"
          aria-label="Alasan penolakan"
          autoFocus
        />
        <button type="button" className="btn btn-ghost" onClick={() => setIsRejecting(false)} disabled={isSaving}>
          Batal
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void decide('Rejected')}
          disabled={isSaving || note.trim().length < 3}
        >
          Tolak SPL
        </button>
      </div>
    )
  }

  return (
    <div className="decision-bar">
      <button type="button" className="btn btn-ghost" onClick={() => setIsRejecting(true)} disabled={isSaving}>
        <X size={16} aria-hidden="true" />
        Tolak
      </button>
      <button type="button" className="btn btn-success" onClick={() => void decide('Approved')} disabled={isSaving}>
        <Check size={16} aria-hidden="true" />
        Setujui
      </button>
    </div>
  )
}
