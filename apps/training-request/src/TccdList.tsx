import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import {
  Ban,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Hourglass,
  MessageSquare,
  Minus,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { StatusFilterBar } from './StatusFilterBar'
import { ApprovalFlowTCCDService, TCCDPARTICIPANTSService, TCCDService } from './generated'
import type { ApprovalFlowTCCDRead } from './generated/models/ApprovalFlowTCCDModel'
import type { TCCDPARTICIPANTSRead } from './generated/models/TCCDPARTICIPANTSModel'
import type { TCCDRead, TCCDWrite } from './generated/models/TCCDModel'
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from './powerAppsData'

type TccdRequestRow = {
  id: string
  tccdNo: string
  picName: string
  picEmail: string
  picPhoto: string
  requestorName: string
  requestorEmail: string
  title: string
  note: string
  requestDate: string
  status: string
  rawDate: number
  request: TCCDRead
}

type CurrentUser = {
  name: string
  email: string
  claims: string
}

type RequestEditValues = {
  note: string
  justification: string
  objective: string
  planningDate: string
  learningImplement: string
  requestType: string
}

type DetailMode = 'view' | 'edit'

type StatusConfig = {
  label: string
  icon: typeof Hourglass
  tone: string
}

const statusConfigs: StatusConfig[] = [
  { label: 'Waiting Assign', icon: Hourglass, tone: 'waiting-assign' },
  { label: 'Assigned', icon: UserCheck, tone: 'assigned' },
  { label: 'Waiting Approval', icon: Send, tone: 'waiting-approval' },
  { label: 'Fully Approved', icon: CheckCircle2, tone: 'fully-approved' },
  { label: 'Closed', icon: ClipboardCheck, tone: 'closed' },
  { label: 'Cancelled', icon: Ban, tone: 'canceled' },
  { label: 'Rejected', icon: XCircle, tone: 'rejected' },
]

const pageSize = 10
const userFetchLimit = 500

const selectedColumns = [
  'ID',
  'TCCD_NO',
  'Title',
  'COURSE_TITLE',
  'TYPE_OF_REQUEST',
  'PLANNING_DATE',
  'JUSTIFICATION',
  'OBJECTIVE',
  'PROVIDER',
  'NUMBER_PARTICIPANT',
  'REQUEST_STATUS',
  'NOTE',
  'Created',
  'Author',
  'Author#Claims',
  'PIC',
]

type ApproverStep = {
  name: string
  email: string
  jobTitle: string
  sequence: number
  status: string
  date: string
  comment: string
}

const participantColumns = [
  'ID',
  'TCCD_NO',
  'SN',
  'NAME',
  'DIVISION',
  'SITE_AREA',
  'EMPLOYEE_STATUS',
  'EMAIL',
  'SERVICE_YEAR',
]

const approvalFlowColumns = [
  'ID',
  'Title',
  'Approver_name',
  'Approver_name#Claims',
  'Status_Flow',
  'Department_App',
  'Seq_approval',
  'Approval_date',
  'Comment',
]

export function TccdList() {
  const [requests, setRequests] = useState<TCCDRead[]>([])
  const [selectedRow, setSelectedRow] = useState<TccdRequestRow | null>(null)
  const [participants, setParticipants] = useState<TCCDPARTICIPANTSRead[]>([])
  const [isParticipantLoading, setIsParticipantLoading] = useState(false)
  const [participantError, setParticipantError] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>('view')
  const [editValues, setEditValues] = useState<RequestEditValues | null>(null)
  const [isDetailSaving, setIsDetailSaving] = useState(false)
  const [detailActionError, setDetailActionError] = useState<string | null>(null)
  const [approvalSteps, setApprovalSteps] = useState<ApproverStep[]>([])
  const [isApprovalLoading, setIsApprovalLoading] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sets state only after the requests resolve, so it is safe to call from the mount effect.
  function fetchRequests() {
    return getCurrentPowerAppsUser()
      .then(async (user) => {
        const userRequests = await getRequestsForUser(user)

        setCurrentUser(user)
        setRequests(userRequests)
        setPage(1)
      })
      .catch((caughtError: unknown) => {
        setCurrentUser(null)
        setRequests([])
        setError(getReadableError(caughtError))
      })
  }

  function refreshRequests() {
    setIsRefreshing(true)
    setError(null)
    void fetchRequests().finally(() => setIsRefreshing(false))
  }

  useEffect(() => {
    void fetchRequests().finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    // openDetail/closeDetail reset the detail state; this effect only fetches.
    if (!selectedRow?.tccdNo) return

    const activeTccdNo = selectedRow.tccdNo
    let isMounted = true

    async function loadParticipants() {
      setIsParticipantLoading(true)
      setParticipantError(null)

      try {
        const participantRows = await getParticipantsForRequest(activeTccdNo)

        if (isMounted) {
          setParticipants(participantRows)
        }
      } catch (caughtError) {
        if (isMounted) {
          setParticipants([])
          setParticipantError(getPowerAppsErrorMessage(caughtError, 'Participant belum bisa dimuat'))
        }
      } finally {
        if (isMounted) {
          setIsParticipantLoading(false)
        }
      }
    }

    void loadParticipants()

    return () => {
      isMounted = false
    }
  }, [selectedRow])

  useEffect(() => {
    if (!selectedRow?.tccdNo) return

    const activeTccdNo = selectedRow.tccdNo
    let isMounted = true

    async function loadApprovalFlow() {
      setIsApprovalLoading(true)
      setApprovalError(null)

      try {
        const steps = await getApprovalFlowSteps(activeTccdNo)

        if (isMounted) {
          setApprovalSteps(steps)
        }
      } catch (caughtError) {
        if (isMounted) {
          setApprovalSteps([])
          setApprovalError(getPowerAppsErrorMessage(caughtError, 'Approval flow belum bisa dimuat'))
        }
      } finally {
        if (isMounted) {
          setIsApprovalLoading(false)
        }
      }
    }

    void loadApprovalFlow()

    return () => {
      isMounted = false
    }
  }, [selectedRow])

  const rows = useMemo(() => requests.map(mapRequestToRow).sort((a, b) => b.rawDate - a.rawDate), [requests])

  const summary = useMemo(() => buildStatusSummary(rows), [rows])

  const filteredRows = useMemo(
    () => filterRows(rows, search, activeStatus),
    [activeStatus, rows, search],
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const pageStartIndex = (activePage - 1) * pageSize
  const pageRows = filteredRows.slice(pageStartIndex, pageStartIndex + pageSize)

  function openDetail(row: TccdRequestRow) {
    setSelectedRow(row)
    setParticipants([])
    setParticipantError(null)
    setApprovalSteps([])
    setApprovalError(null)
    setDetailActionError(null)
    setDetailMode('view')
    setEditValues(createEditValues(row))
    setIsParticipantLoading(Boolean(row.tccdNo))
    setIsApprovalLoading(Boolean(row.tccdNo))
  }

  function closeDetail() {
    setSelectedRow(null)
    setDetailMode('view')
    setEditValues(null)
    setParticipants([])
    setParticipantError(null)
    setApprovalSteps([])
    setApprovalError(null)
    setIsParticipantLoading(false)
    setIsApprovalLoading(false)
    setDetailActionError(null)
  }

  function startEdit() {
    if (!selectedRow || isCanceledStatus(selectedRow.status)) {
      return
    }

    setEditValues(createEditValues(selectedRow))
    setDetailActionError(null)
    setDetailMode('edit')
  }

  function updateEditValue(field: keyof RequestEditValues, value: string) {
    setEditValues((currentValues) =>
      currentValues
        ? {
            ...currentValues,
            [field]: value,
          }
        : currentValues,
    )
  }

  async function saveRequestChanges() {
    if (!selectedRow || !editValues) {
      return
    }

    await updateSelectedRequest({
      TYPE_OF_REQUEST: editValues.requestType,
      TYPE_OF_LEARNING: editValues.requestType,
      PLANNING_DATE: editValues.planningDate,
      PROVIDER: editValues.learningImplement,
      NOTE: editValues.note.trim(),
      JUSTIFICATION: editValues.justification.trim(),
      OBJECTIVE: editValues.objective.trim(),
    })
    setDetailMode('view')
  }

  async function cancelSelectedRequest() {
    if (!selectedRow || isCanceledStatus(selectedRow.status)) {
      return
    }

    await updateSelectedRequest({
      REQUEST_STATUS: 'Cancelled',
    })
    setDetailMode('view')
  }

  async function updateSelectedRequest(changedFields: Partial<Omit<TCCDWrite, 'ID'>>) {
    if (!selectedRow?.request.ID) {
      setDetailActionError('Request tidak memiliki ID SharePoint, jadi belum bisa diupdate.')
      return
    }

    setIsDetailSaving(true)
    setDetailActionError(null)

    try {
      const result = await withPowerAppsTimeout(TCCDService.update(String(selectedRow.request.ID), changedFields))

      if (!result.success) {
        throw new Error(
          result.error
            ? `Gagal mengupdate request: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`
            : 'Gagal mengupdate request. Silakan coba lagi.',
        )
      }

      const updatedRequest: TCCDRead = {
        ...selectedRow.request,
        ...changedFields,
      }
      const updatedRow = mapRequestToRow(updatedRequest)

      setRequests((currentRequests) =>
        currentRequests.map((request) => (request.ID === updatedRequest.ID ? updatedRequest : request)),
      )
      setSelectedRow(updatedRow)
      setEditValues(createEditValues(updatedRow))
    } catch (caughtError) {
      setDetailActionError(getPowerAppsErrorMessage(caughtError, 'Request belum bisa diupdate'))
    } finally {
      setIsDetailSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="request-list-section section-container">
        <div className="admin-state-card">Memuat data request dari SharePoint...</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="request-list-section section-container">
        <div className="admin-state-card">{error}</div>
      </section>
    )
  }

  return (
    <section className="request-list-section section-container">
      <div className="admin-hero">
        <div>
          <h1>Data Pengajuan Training</h1>
          <p>
            Data yang tampil dibatasi hanya untuk pengajuan yang dibuat oleh user login.
          </p>
          {currentUser ? <span className="request-scope">Login sebagai {currentUser.name}</span> : null}
        </div>
        <div className="admin-hero-actions">
          <button
            type="button"
            className="refresh-data-button"
            onClick={refreshRequests}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <a className="create-request-button" href="#/request-form">
            Buat Pengajuan
          </a>
        </div>
      </div>

      <StatusFilterBar
        options={statusConfigs}
        counts={summary}
        total={rows.length}
        activeStatus={activeStatus}
        onChange={(status) => {
          setPage(1)
          setActiveStatus(status)
        }}
      />

      <div className="admin-toolbar">
        <label className="search-field">
          <span className="search-box">
            <Search size={16} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari TCCD No, judul training, PIC..."
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                aria-label="Hapus pencarian"
              >
                <X size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            ) : null}
          </span>
        </label>
        <div className="admin-filter-state">
          <span>{activeStatus ? `Filter: ${activeStatus}` : ''}</span>
          {activeStatus || search ? (
            <button
              type="button"
              onClick={() => {
                setActiveStatus(null)
                setSearch('')
                setPage(1)
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="request-table-wrap admin-table-wrap">
        <div className="admin-table-meta">
          <span>
            Menampilkan {filteredRows.length} dari {rows.length} Pengajuan
          </span>
        </div>
        <table className="request-table">
          <thead>
            <tr>
              <th>TCCD No</th>
              <th>Course Title</th>
              <th>Type</th>
              <th>PIC</th>
              <th className="table-heading-center">Planning Date</th>
              <th className="table-heading-center">Participant</th>
              <th className="table-heading-center">Request Date</th>
              <th className="table-heading-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td className="table-message" colSpan={8}>
                  Data request tidak ditemukan.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  className="request-row"
                  tabIndex={0}
                  role="button"
                  onClick={() => openDetail(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openDetail(row)
                    }
                  }}
                >
                  <td data-label="TCCD No">{row.tccdNo || '-'}</td>
                  <td data-label="Judul Training">
                    <strong>{row.title}</strong>
                  </td>
                  <td data-label="Type">{cleanText(row.request.TYPE_OF_REQUEST) || '-'}</td>
                  <td data-label="PIC">{row.picName || '-'}</td>
                  <td className="table-cell-center" data-label="Planning Date">
                    {formatDateFromText(row.request.PLANNING_DATE)}
                  </td>
                  <td className="table-cell-center" data-label="Participant">
                    {formatNumber(row.request.NUMBER_PARTICIPANT)}
                  </td>
                  <td className="table-cell-center" data-label="Tanggal Request">
                    {row.requestDate}
                  </td>
                  <td className="table-cell-center" data-label="Status">
                    <span className={getStatusClassName(row.status)}>{getStatusDisplayLabel(row.status)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && !error && filteredRows.length > 0 ? (
        <div className="pagination-bar" aria-label="Pagination data request">
          <span>
            
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={activePage === 1}
            >
              Previous
            </button>
            <strong>
              {activePage} / {totalPages}
            </strong>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={activePage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <RequestDetailPanel
          row={selectedRow}
          participants={participants}
          isLoading={isParticipantLoading}
          error={participantError}
          approvalSteps={approvalSteps}
          isApprovalLoading={isApprovalLoading}
          approvalError={approvalError}
          mode={detailMode}
          editValues={editValues}
          isSaving={isDetailSaving}
          actionError={detailActionError}
          onClose={closeDetail}
          onEdit={startEdit}
          onCancelEdit={() => {
            setDetailActionError(null)
            setDetailMode('view')
            setEditValues(selectedRow ? createEditValues(selectedRow) : null)
          }}
          onEditValueChange={updateEditValue}
          onSave={saveRequestChanges}
          onCancelRequest={cancelSelectedRequest}
        />
      ) : null}
    </section>
  )
}

const PARTICIPANT_ROW_DESKTOP = 60
const PARTICIPANT_OVERSCAN = 6
const PARTICIPANT_MAX_HEIGHT = 380

function VirtualParticipantList({ participants }: { participants: TCCDPARTICIPANTSRead[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ top: 0, height: PARTICIPANT_MAX_HEIGHT, rowHeight: PARTICIPANT_ROW_DESKTOP })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const updateViewport = () => {
      const style = getComputedStyle(element)
      const declaredRowHeight = Number.parseInt(style.getPropertyValue('--participant-row-h'), 10)
      const rowHeight = Number.isFinite(declaredRowHeight) && declaredRowHeight > 0 ? declaredRowHeight : PARTICIPANT_ROW_DESKTOP
      setViewport({ top: element.scrollTop, height: element.clientHeight || PARTICIPANT_MAX_HEIGHT, rowHeight })
    }

    updateViewport()
    element.addEventListener('scroll', updateViewport, { passive: true })
    const resizeObserver = new ResizeObserver(updateViewport)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', updateViewport)
      resizeObserver.disconnect()
    }
  }, [])

  const total = participants.length
  const rowHeight = viewport.rowHeight
  const contentHeight = total * rowHeight
  const startIndex = Math.max(0, Math.floor(viewport.top / rowHeight) - PARTICIPANT_OVERSCAN)
  const endIndex = Math.min(total, Math.ceil((viewport.top + viewport.height) / rowHeight) + PARTICIPANT_OVERSCAN)
  const visibleParticipants = participants.slice(startIndex, endIndex)

  return (
    <div
      className="participant-detail-list"
      ref={scrollRef}
      style={{ height: Math.min(contentHeight, PARTICIPANT_MAX_HEIGHT) }}
    >
      <div style={{ height: contentHeight, position: 'relative' }}>
        {visibleParticipants.map((participant, offset) => {
          const index = startIndex + offset
          return (
            <div
              className="participant-detail-row"
              key={participant.ID ?? `${participant.SN}-${participant.NAME}-${index}`}
              style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: rowHeight }}
            >
              <div>
                <strong>{cleanText(participant.NAME) || '-'}</strong>
                <span>{cleanText(participant.SN) || '-'}</span>
              </div>
              <div>
                <span>{cleanText(participant.DIVISION) || '-'}</span>
                <span>{cleanText(participant.SITE_AREA) || '-'}</span>
              </div>
              <span className="participant-status">{cleanText(participant.EMPLOYEE_STATUS) || '-'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PersonBadge({ name, email, photoUrl }: { name: string; email: string; photoUrl: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const isAssigned = Boolean(cleanText(name))
  const displayName = isAssigned ? name : ''
  const shouldShowImage = isAssigned && Boolean(photoUrl) && !imageFailed

  if (!isAssigned) {
    return (
      <div className="person-unassigned">
        <strong>{displayName}</strong>
        <span>-</span>
      </div>
    )
  }

  return (
    <div className="person-badge">
      <span className="person-avatar" aria-hidden="true">
        {shouldShowImage ? (
          <img src={photoUrl} alt="" onError={() => setImageFailed(true)} />
        ) : (
          getInitials(displayName)
        )}
      </span>
      <span className="person-meta">
        <strong>{displayName}</strong>
        {email ? <span>{email}</span> : null}
      </span>
    </div>
  )
}

function RequestDetailPanel({
  row,
  participants,
  isLoading,
  error,
  approvalSteps,
  isApprovalLoading,
  approvalError,
  mode,
  editValues,
  isSaving,
  actionError,
  onClose,
  onEdit,
  onCancelEdit,
  onEditValueChange,
  onSave,
  onCancelRequest,
}: {
  row: TccdRequestRow
  participants: TCCDPARTICIPANTSRead[]
  isLoading: boolean
  error: string | null
  approvalSteps: ApproverStep[]
  isApprovalLoading: boolean
  approvalError: string | null
  mode: DetailMode
  editValues: RequestEditValues | null
  isSaving: boolean
  actionError: string | null
  onClose: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onEditValueChange: (field: keyof RequestEditValues, value: string) => void
  onSave: () => Promise<void>
  onCancelRequest: () => Promise<void>
}) {
  const isCanceled = isCanceledStatus(row.status)
  const isEditing = mode === 'edit' && Boolean(editValues) && !isCanceled

  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="request-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail request ${row.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-panel-header">
          <div>
            <span className="detail-kicker">{isEditing ? 'Edit Pengajuan' : row.tccdNo || 'TCCD request'}</span>
            <h3>{row.title}</h3>
          </div>
          <button type="button" className="detail-close-button" onClick={onClose} aria-label="Tutup detail">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="detail-summary">
          <PersonBadge name={row.picName} email={row.picEmail} photoUrl={row.picPhoto} />
          <span className={getStatusClassName(row.status)}>{getStatusDisplayLabel(row.status)}</span>
        </div>

        {!isEditing ? (
          <div className="detail-actions">
            <button type="button" className="detail-secondary-action" onClick={onEdit} disabled={isCanceled || isSaving}>
              Edit
            </button>
            <button
              type="button"
              className="detail-danger-action"
              onClick={() => void onCancelRequest()}
              disabled={isCanceled || isSaving}
            >
              {isSaving ? 'Memproses...' : 'Batalkan Pengajuan Training'}
            </button>
          </div>
        ) : null}

        {isCanceled ? (
          <div className="detail-empty-state">Request sudah berstatus final, sehingga tidak bisa diedit.</div>
        ) : null}

        {actionError ? <div className="detail-empty-state detail-error-state">{actionError}</div> : null}

        {isEditing && editValues ? (
          <>
            <div className="detail-edit-group">
              <h5 className="detail-edit-group-title">Informasi Umum</h5>
              <div className="detail-edit-grid">
                <EditField label="Type of Request">
                  <select
                    value={editValues.requestType}
                    onChange={(event) => onEditValueChange('requestType', event.target.value)}
                    disabled={isSaving}
                  >
                    <option value="training">Training</option>
                    <option value="certification">Certification</option>
                  </select>
                </EditField>
                <EditField label="Planning Date">
                  <input
                    type="date"
                    value={editValues.planningDate}
                    onChange={(event) => onEditValueChange('planningDate', event.target.value)}
                    disabled={isSaving}
                  />
                </EditField>
                <EditField label="Learning Implementation">
                  <select
                    value={editValues.learningImplement}
                    onChange={(event) => onEditValueChange('learningImplement', event.target.value)}
                    disabled={isSaving}
                  >
                    <option value="internal">Internal</option>
                    <option value="eksternal">External</option>
                  </select>
                </EditField>
              </div>
            </div>
            <div className="detail-edit-group">
              <h5 className="detail-edit-group-title">Detail Pengajuan</h5>
              <div className="detail-edit-grid">
                <EditField label="Note" wide>
                  <textarea
                    value={editValues.note}
                    onChange={(event) => onEditValueChange('note', event.target.value)}
                    rows={3}
                    disabled={isSaving}
                  />
                </EditField>
                <EditField label="Justification" wide>
                  <textarea
                    value={editValues.justification}
                    onChange={(event) => onEditValueChange('justification', event.target.value)}
                    rows={4}
                    disabled={isSaving}
                  />
                </EditField>
                <EditField label="Objective" wide>
                  <textarea
                    value={editValues.objective}
                    onChange={(event) => onEditValueChange('objective', event.target.value)}
                    rows={4}
                    disabled={isSaving}
                  />
                </EditField>
              </div>
            </div>
            <div className="detail-edit-footer">
              <button type="button" className="detail-secondary-action" onClick={onCancelEdit} disabled={isSaving}>
                Batalkan
              </button>
              <button type="button" className="detail-primary-action" onClick={() => void onSave()} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </>
        ) : (
          <dl className="detail-grid">
            <DetailItem label="Request Date" value={row.requestDate} />
            <DetailItem label="Type of Request" value={cleanText(row.request.TYPE_OF_REQUEST) || '-'} />
            <DetailItem label="Planning Date" value={formatDateFromText(row.request.PLANNING_DATE)} />
            <DetailItem label="Learning Implementation" value={cleanText(row.request.PROVIDER) || '-'} />
            <DetailItem label="Number Participant" value={formatNumber(row.request.NUMBER_PARTICIPANT)} />
            <DetailItem label="Note" value={row.note} wide />
            <DetailItem label="Justification" value={cleanText(row.request.JUSTIFICATION) || '-'} wide />
            <DetailItem label="Objective" value={cleanText(row.request.OBJECTIVE) || '-'} wide />
          </dl>
        )}
        <ApprovalStepper
          steps={approvalSteps}
          isLoading={isApprovalLoading}
          error={approvalError}
        />

        <div className="participant-detail-block">
          <div className="participant-detail-header">
            <div>
              <h4>Participant</h4>
              <p>{participants.length} participant terkait request ini.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="detail-empty-state">Memuat participant...</div>
          ) : error ? (
            <div className="detail-empty-state detail-error-state">{error}</div>
          ) : participants.length === 0 ? (
            <div className="detail-empty-state">Participant belum ditemukan untuk TCCD_NO ini.</div>
          ) : (
            <VirtualParticipantList participants={participants} />
          )}
        </div>
      </aside>
    </div>
  )
}

function DetailItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'detail-item detail-item-wide' : 'detail-item'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function EditField({
  label,
  children,
  wide,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={wide ? 'detail-edit-field detail-edit-field-wide' : 'detail-edit-field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function ApprovalStepper({
  steps,
  isLoading,
  error,
}: {
  steps: ApproverStep[]
  isLoading: boolean
  error: string | null
}) {
  if (isLoading) {
    return (
      <div className="participant-detail-block">
        <div className="participant-detail-header">
          <div>
            <h4>Approval Progress</h4>
            <p>Memuat data approval...</p>
          </div>
        </div>
        <div className="detail-empty-state">Memuat approval flow...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="participant-detail-block">
        <div className="participant-detail-header">
          <div>
            <h4>Approval Progress</h4>
            <p>Gagal memuat data approval.</p>
          </div>
        </div>
        <div className="detail-empty-state detail-error-state">{error}</div>
      </div>
    )
  }

  if (steps.length === 0) {
    return null
  }

  return (
    <div className="participant-detail-block">
      <div className="participant-detail-header">
        <div>
          <h4>Approval Progress</h4>
          <p>{steps.length} approver dalam antrian approval.</p>
        </div>
      </div>

      <div className="approval-vertical-chain" aria-label="Alur approval berjenjang">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const normalizedStatus = step.status.toLowerCase()
          const isSkipped = steps.slice(0, index).some((previousStep) => previousStep.status.toLowerCase().includes('reject'))
          const isApproved = !isSkipped && normalizedStatus.includes('approve')
          const isRejected = !isSkipped && normalizedStatus.includes('reject')
          const iconTone = isSkipped
            ? 'approval-skipped'
            : isApproved
              ? 'approval-approved'
              : isRejected
                ? 'approval-rejected'
                : 'approval-waiting'
          const lineTone = isRejected || isSkipped ? 'approval-skipped' : iconTone

          return (
            <div className="approval-chain-node" key={`${step.sequence}-${index}`}>
              <div className="approval-chain-rail" aria-hidden="true">
                <span className={`approval-chain-dot ${iconTone}`}>
                  {isSkipped ? (
                    <Minus size={20} strokeWidth={2.5} />
                  ) : isApproved ? (
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                  ) : isRejected ? (
                    <XCircle size={20} strokeWidth={2.5} />
                  ) : (
                    <Clock size={20} strokeWidth={2.5} />
                  )}
                </span>
                {!isLast ? <span className={`approval-chain-line ${lineTone}`} /> : null}
              </div>
              <div className="approval-chain-body">
                <div className="approval-chain-row">
                  <strong>{step.name}</strong>
                  <span className={`approval-chain-status ${iconTone}`}>
                    {isSkipped ? (
                      <><Minus size={13} strokeWidth={2.5} />Skipped</>
                    ) : isApproved ? (
                      <><CheckCircle2 size={13} strokeWidth={2.5} />Approved</>
                    ) : isRejected ? (
                      <><XCircle size={13} strokeWidth={2.5} />Rejected</>
                    ) : (
                      <><Clock size={13} strokeWidth={2.5} />{step.status || 'Waiting'}</>
                    )}
                  </span>
                </div>
                <span className="approval-chain-meta">
                  {step.jobTitle}
                  {step.date ? `  ·  ${step.date}` : ''}
                </span>
                {step.comment ? (
                  <div className="approval-chain-comment">
                    <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
                    <span>{step.comment}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

async function getCurrentPowerAppsUser(): Promise<CurrentUser> {
  try {
    const context = await Promise.race([getContext(), timeoutAfter(2500)])
    const email = context?.user?.userPrincipalName?.trim().toLowerCase()

    if (email) {
      return {
        name: context.user.fullName?.trim() || email.split('@')[0].replace(/[._-]+/g, ' '),
        email,
        claims: `i:0#.f|membership|${email}`,
      }
    }
  } catch {
    // Mobile player fallback
  }

  throw new Error('User login Power Apps tidak ditemukan. Buka aplikasi melalui Power Apps local play.')
}

async function getRequestsForUser(user: CurrentUser) {
  const filters = [
    `Author/EMail eq '${escapeODataValue(user.email)}'`,
    `Author/Email eq '${escapeODataValue(user.email)}'`,
    `Author#Claims eq '${escapeODataValue(user.claims)}'`,
  ]
  let lastError: unknown = null

  for (const filter of filters) {
    try {
      const result = await withPowerAppsTimeout(
        TCCDService.getAll({
          select: selectedColumns,
          filter,
          top: userFetchLimit,
          orderBy: ['Created desc'],
        }),
      )

      return Array.isArray(result.data) ? result.data : []
    } catch (caughtError) {
      lastError = caughtError
    }
  }

  try {
    const result = await withPowerAppsTimeout(
      TCCDService.getAll({
        select: selectedColumns,
        top: userFetchLimit,
        orderBy: ['Created desc'],
      }),
    )

    return (Array.isArray(result.data) ? result.data : []).filter((request) =>
      requestBelongsToUser(request, user),
    )
  } catch {
    throw lastError instanceof Error ? lastError : new Error('Filter user SharePoint gagal dijalankan.')
  }
}

function mapRequestToRow(request: TCCDRead): TccdRequestRow {
  const createdDate = request.Created ? new Date(request.Created) : null
  const fallbackId = request.ID ?? request.IDROW ?? request.TCCD_NO ?? request.Title ?? crypto.randomUUID()

  return {
    id: String(fallbackId),
    tccdNo: cleanText(request.TCCD_NO),
    picName: cleanText(request.PIC?.DisplayName),
    picEmail: cleanText(request.PIC?.Email),
    picPhoto: cleanText(request.PIC?.Picture),
    requestorName: cleanText(request.Author?.DisplayName),
    requestorEmail: cleanText(request.Author?.Email),
    title: cleanText(request.COURSE_TITLE) || cleanText(request.Title) || '-',
    note: cleanText(request.NOTE) || '-',
    requestDate: formatDate(createdDate),
    status: cleanText(request.REQUEST_STATUS) || 'No Status',
    rawDate: createdDate?.getTime() ?? 0,
    request,
  }
}

function createEditValues(row: TccdRequestRow): RequestEditValues {
  return {
    note: cleanText(row.request.NOTE),
    justification: cleanText(row.request.JUSTIFICATION),
    objective: cleanText(row.request.OBJECTIVE),
    planningDate: toDateInputValue(row.request.PLANNING_DATE),
    learningImplement: cleanText(row.request.PROVIDER) || 'internal',
    requestType: cleanText(row.request.TYPE_OF_REQUEST) || 'training',
  }
}

function buildStatusSummary(rows: TccdRequestRow[]) {
  return statusConfigs.reduce<Record<string, number>>((summary, status) => {
    summary[status.label] = rows.filter(
      (row) => normalizeStatus(row.status) === normalizeStatus(status.label),
    ).length
    return summary
  }, {})
}

function filterRows(rows: TccdRequestRow[], search: string, activeStatus: string | null) {
  const normalizedSearch = search.trim().toLowerCase()
  const normalizedStatusFilter = activeStatus ? normalizeStatus(activeStatus) : ''

  return rows.filter((row) => {
    const statusMatches = normalizedStatusFilter
      ? normalizeStatus(row.status) === normalizedStatusFilter
      : true

    if (!statusMatches) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [
      row.tccdNo,
      row.title,
      row.picName,
      row.picEmail,
      row.requestorName,
      row.status,
      row.note,
      row.request.NOTE,
      row.request.TYPE_OF_REQUEST,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  })
}

async function getParticipantsForRequest(tccdNo: string) {
  const normalizedTccdNo = tccdNo.trim()

  if (!normalizedTccdNo) {
    return []
  }

  const filter = `TCCD_NO eq '${escapeODataValue(normalizedTccdNo)}'`

  try {
    const result = await withPowerAppsTimeout(
      TCCDPARTICIPANTSService.getAll({
        select: participantColumns,
        filter,
        top: 300,
        orderBy: ['ID asc'],
      }),
    )

    return Array.isArray(result.data) ? result.data : []
  } catch {
    const result = await withPowerAppsTimeout(
      TCCDPARTICIPANTSService.getAll({
        select: participantColumns,
        top: 500,
        orderBy: ['ID asc'],
      }),
    )

    return (Array.isArray(result.data) ? result.data : []).filter(
      (participant) => cleanText(participant.TCCD_NO) === normalizedTccdNo,
    )
  }
}

async function getApprovalFlowSteps(tccdNo: string): Promise<ApproverStep[]> {
  const normalizedTccdNo = tccdNo.trim()

  if (!normalizedTccdNo) {
    return []
  }

  const filter = `Title eq '${escapeODataValue(normalizedTccdNo)}'`

  try {
    const result = await withPowerAppsTimeout(
      ApprovalFlowTCCDService.getAll({
        select: approvalFlowColumns,
        filter,
        top: 100,
        orderBy: ['Seq_approval asc'],
      }),
    )

    const data = Array.isArray(result.data) ? result.data : []

    return data.map(mapApprovalFlowToStep).sort((a, b) => a.sequence - b.sequence)
  } catch {
    const result = await withPowerAppsTimeout(
      ApprovalFlowTCCDService.getAll({
        select: approvalFlowColumns,
        top: 500,
        orderBy: ['Seq_approval asc'],
      }),
    )

    const data = (Array.isArray(result.data) ? result.data : []).filter(
      (row) => cleanText(row.Title) === normalizedTccdNo,
    )

    return data.map(mapApprovalFlowToStep).sort((a, b) => a.sequence - b.sequence)
  }
}

function mapApprovalFlowToStep(row: ApprovalFlowTCCDRead): ApproverStep {
  return {
    name: cleanText(row.Approver_name?.DisplayName) || '-',
    email: cleanText(row.Approver_name?.Email),
    jobTitle: cleanText(row.Department_App) || cleanText(row.Approver_name?.JobTitle) || '-',
    sequence: typeof row.Seq_approval === 'number' ? row.Seq_approval : 0,
    status: cleanText(row.Status_Flow) || 'Waiting',
    date: formatApprovalDate(row.Approval_date),
    comment: cleanText(row.Comment),
  }
}

function formatApprovalDate(value?: string | null) {
  const cleanedValue = cleanText(value)

  if (!cleanedValue) {
    return ''
  }

  const date = new Date(cleanedValue)

  if (Number.isNaN(date.getTime())) {
    return cleanedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function escapeODataValue(value: string) {
  return value.replace(/'/g, "''")
}

function timeoutAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Power Apps user context timeout.')), timeoutMs)
  })
}

function formatDate(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateFromText(value?: string | null) {
  const cleanedValue = cleanText(value)

  if (!cleanedValue) {
    return '-'
  }

  const date = new Date(cleanedValue)
  return Number.isNaN(date.getTime()) ? cleanedValue : formatDate(date)
}

function toDateInputValue(value?: string | null) {
  const cleanedValue = cleanText(value)

  if (!cleanedValue) {
    return ''
  }

  const date = new Date(cleanedValue)

  if (Number.isNaN(date.getTime())) {
    return cleanedValue.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function formatNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '-'
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return 'NA'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, 'A')
}

function cleanText(value?: string | null) {
  return value?.trim() ?? ''
}

function requestBelongsToUser(request: TCCDRead, user: CurrentUser) {
  const authorEmail = cleanText(request.Author?.Email).toLowerCase()
  const authorClaims = cleanText(request['Author#Claims']).toLowerCase()

  return authorEmail === user.email || authorClaims === user.claims.toLowerCase()
}

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase().replace(/\s+/g, ' ').trim()
  // Handle cancel variations — canonical form is 'cancelled'
  if (normalized.includes('cancel') || normalized.includes('canceled') || normalized.includes('cancelled')) return 'cancelled'
  if (normalized.includes('reject')) return 'rejected'
  if (normalized.includes('approved') || normalized.includes('fully approved')) return 'fully approved'
  if (normalized.includes('closed')) return 'closed'
  if (normalized.includes('assign') && normalized.includes('waiting')) return 'waiting assign'
  if (normalized.includes('assign')) return 'assigned'
  if (normalized.includes('approval') && normalized.includes('waiting')) return 'waiting approval'
  return normalized
}

function isCanceledStatus(status: string) {
  const normalizedStatus = status.toLowerCase()
  return (
    normalizedStatus.includes('cancel') ||
    normalizedStatus.includes('reject') ||
    normalizedStatus.includes('closed')
  )
}

function getStatusClassName(status: string) {
  const normalizedStatus = status.toLowerCase().trim()

  if (normalizedStatus.includes('waiting') && normalizedStatus.includes('assign')) return 'status-badge status-waiting-assign'
  if (normalizedStatus.includes('assigned')) return 'status-badge status-assigned'
  if (normalizedStatus.includes('waiting') && normalizedStatus.includes('approval')) return 'status-badge status-waiting-approval'
  if (normalizedStatus.includes('fully') || normalizedStatus.includes('approved')) return 'status-badge status-fully-approved'
  if (normalizedStatus.includes('closed')) return 'status-badge status-closed'
  if (normalizedStatus.includes('cancel')) return 'status-badge status-canceled'
  if (normalizedStatus.includes('reject')) return 'status-badge status-rejected'

  return 'status-badge'
}

function getStatusDisplayLabel(status: string) {
  return normalizeStatus(status)
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getReadableError(error: unknown) {
  return getPowerAppsErrorMessage(error, 'Data SharePoint belum bisa dimuat')
}
