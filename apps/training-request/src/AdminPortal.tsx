import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Ban,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HelpCircle,
  Hourglass,
  MessageSquare,
  Minus,
  RefreshCw,
  Send,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import {
  ApprovalFlowTCCDService,
  ApprovalTCCDService,
  DivHead_MemberService,
  TCCDNotificationAssignService,
  TCCDPARTICIPANTSService,
  TCCDService,
} from './generated'
import type {
  ApprovalFlowTCCDRead,
  ApprovalFlowTCCDWrite,
  Approver_nameValue,
} from './generated/models/ApprovalFlowTCCDModel'
import type { DivHead_MemberRead } from './generated/models/DivHead_MemberModel'
import type { MemberTCCDRead, PIC_TCCDValue } from './generated/models/MemberTCCDModel'
import type { TCCDPARTICIPANTSRead } from './generated/models/TCCDPARTICIPANTSModel'
import type { PICValue, TCCDRead, TCCDWrite } from './generated/models/TCCDModel'
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from './powerAppsData'
import { findEmployeeByPersonnelNumber, loadEmployeeLookup, type EmployeeLookupData } from './employeeLookup'
import { getCurrentAdminUser, normalizeAdminRole as normalizeRole } from './adminAccess'
import type { AdminRole, AdminUser } from './adminAccess'

type ApproverStep = {
  name: string
  email: string
  claims: string
  photoUrl: string
  jobTitle: string
  sequence: number
  status: string
  date: string
  comment: string
}

type ToastType = 'success' | 'error' | 'info'

type ToastMessage = {
  id: string
  type: ToastType
  message: string
}

type AdminRow = {
  id: string
  tccdNo: string
  title: string
  picName: string
  picEmail: string
  requestorName: string
  requestorEmail: string
  requestDate: string
  status: string
  rawDate: number
  request: TCCDRead
}

type ParticipantEditRow = {
  sn: string
  name: string
  division: string
  siteArea: string
  employeeStatus: string
  email: string
  serviceYear: string
}

type AdminDetailValues = {
  courseTitle: string
  planningDate: string
  requestType: string
  justification: string
  objective: string
  participantCount: string
  learningImplement: string
  note: string
  budget: string
  expenseCategory: string
  vendorName: string
  typeOfLearning: string
  totalExpense: string
}

type RoutingApprover = {
  id: string
  name: string
  email: string
  claims: string
  jobTitle: string
  person: DivHead_MemberRead['DIVHEAD_PIC']
}

type AdminStatusConfig = {
  label: string
  icon: typeof Hourglass
  tone: string
}

const adminStatusConfigs: AdminStatusConfig[] = [
  { label: 'Waiting Assign', icon: Hourglass, tone: 'waiting-assign' },
  { label: 'Assigned', icon: UserCheck, tone: 'assigned' },
  { label: 'Waiting Approval', icon: Send, tone: 'waiting-approval' },
  { label: 'Fully Approved', icon: CheckCircle2, tone: 'fully-approved' },
  { label: 'Closed', icon: ClipboardCheck, tone: 'closed' },
  { label: 'Cancelled', icon: Ban, tone: 'canceled' },
  { label: 'Rejected', icon: XCircle, tone: 'rejected' },
]

const adminTccdColumns = [
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
  'TOTAL_EXPENSES',
  'REQUEST_STATUS',
  'BUDGET',
  'EXPENSE_CATEGORY',
  'VENDOR_NAME',
  'TYPE_OF_LEARNING',
  'NOTE',
  'Created',
  'Author',
  'PIC',
]

const approvalFlowColumns = [
  'ID',
  'Title',
  'Department_App',
  'Seq_approval',
  'Status_Flow',
  'Approver_name',
  'Approver_name#Claims',
  'Approval_date',
  'Comment',
]

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

const learningOptions = [
  'Behavior',
  'Fundamental',
  'HSE & Energy',
  'Sharing Session',
  'Technical',
  'Technical Support',
]

const adminPageSize = 15

// Error state whose setter also raises an error toast whenever a message is set.
function useToastedError(showToast: (type: ToastType, message: string) => void) {
  const [message, setMessage] = useState<string | null>(null)

  const setError = useCallback(
    (nextMessage: string | null) => {
      setMessage(nextMessage)
      if (nextMessage) showToast('error', nextMessage)
    },
    [showToast],
  )

  return [message, setError] as const
}

export function AdminPortal() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [members, setMembers] = useState<MemberTCCDRead[]>([])
  const [requests, setRequests] = useState<TCCDRead[]>([])
  const [selectedRow, setSelectedRow] = useState<AdminRow | null>(null)
  const [detailValues, setDetailValues] = useState<AdminDetailValues | null>(null)
  const [participants, setParticipants] = useState<TCCDPARTICIPANTSRead[]>([])
  const [approvers, setApprovers] = useState<RoutingApprover[]>([])
  const [selectedApprovers, setSelectedApprovers] = useState<RoutingApprover[]>([])
  const [routingOpen, setRoutingOpen] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [selectedPicClaims, setSelectedPicClaims] = useState('')
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false)
  const [isApproversLoading, setIsApproversLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRoutingSaving, setIsRoutingSaving] = useState(false)
  const [isFlowRunning, setIsFlowRunning] = useState(false)
  const [approvalChainSteps, setApprovalChainSteps] = useState<ApproverStep[]>([])
  const [isApprovalChainLoading, setIsApprovalChainLoading] = useState(false)
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [editParticipantForm, setEditParticipantForm] = useState<ParticipantEditRow | null>(null)
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)
  const [newParticipantForm, setNewParticipantForm] = useState<ParticipantEditRow>(emptyParticipantRow())
  const [isParticipantSaving, setIsParticipantSaving] = useState(false)
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookupData | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

      setToasts((current) => [...current.slice(-3), { id, type, message }])
      window.setTimeout(() => dismissToast(id), 5200)
    },
    [dismissToast],
  )

  const [participantActionError, setParticipantActionError] = useToastedError(showToast)
  const [error, setError] = useToastedError(showToast)
  const [detailError, setDetailError] = useToastedError(showToast)
  const [routingError, setRoutingError] = useToastedError(showToast)
  const [approvalRunLocks, setApprovalRunLocks] = useState<Set<string>>(() => new Set())
  const [approvalChainError, setApprovalChainError] = useToastedError(showToast)

  useEffect(() => {
    loadEmployeeLookup()
      .then(setEmployeeLookup)
      .catch(() => {})
  }, [])

  // Sets state only after the requests resolve, so it is safe to call from the mount effect.
  const fetchAdminData = useCallback(
    () =>
      getCurrentAdminUser()
        .then(async ({ user, members: memberRows }) => {
          const requestRows = await getAdminRequests()

          setAdminUser(user)
          setMembers(memberRows)
          setRequests(requestRows)
          setPage(1)
          return true
        })
        .catch((caughtError: unknown) => {
          setAdminUser(null)
          setMembers([])
          setRequests([])
          setError(getPowerAppsErrorMessage(caughtError, 'Portal Admin belum bisa dibuka'))
          return false
        }),
    [setError],
  )

  function refreshAdminData() {
    setIsRefreshing(true)
    setError(null)
    void fetchAdminData()
      .then((loaded) => {
        if (loaded) showToast('success', 'Data admin berhasil direfresh.')
      })
      .finally(() => setIsRefreshing(false))
  }

  useEffect(() => {
    void fetchAdminData().finally(() => setIsLoading(false))
  }, [fetchAdminData])

  // Read inside the approval-chain effect without re-running it when the list is cached.
  const approversRef = useRef(approvers)
  useEffect(() => {
    approversRef.current = approvers
  }, [approvers])

  useEffect(() => {
    // openDetail/closeDetail reset the detail state; this effect only fetches.
    if (!selectedRow?.tccdNo) return

    const activeTccdNo = selectedRow.tccdNo
    let isMounted = true

    async function loadChain() {
      setIsApprovalChainLoading(true)
      setApprovalChainError(null)

      try {
        const steps = await getApprovalChainSteps(activeTccdNo)
        const needsPhotoFallback = steps.some((step) => !step.photoUrl)
        const approvers = approversRef.current
        const masterApprovers = needsPhotoFallback
          ? approvers.length > 0
            ? approvers
            : await getRoutingApprovers()
          : approvers
        const hydratedSteps = needsPhotoFallback ? hydrateApprovalStepPhotos(steps, masterApprovers) : steps

        if (isMounted) {
          setApprovalChainSteps(hydratedSteps)
          if (needsPhotoFallback && approvers.length === 0) {
            setApprovers(masterApprovers)
          }
        }
      } catch (caughtError) {
        if (isMounted) {
          setApprovalChainSteps([])
          setApprovalChainError(getPowerAppsErrorMessage(caughtError, 'Approval chain belum bisa dimuat'))
        }
      } finally {
        if (isMounted) {
          setIsApprovalChainLoading(false)
        }
      }
    }

    void loadChain()

    return () => {
      isMounted = false
    }
  }, [selectedRow, setApprovalChainError])

  const rows = useMemo(() => requests.map(mapAdminRow).sort((a, b) => b.rawDate - a.rawDate), [requests])
  const filteredRows = useMemo(
    () => filterAdminRows(rows, search, activeStatus),
    [activeStatus, rows, search],
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / adminPageSize))
  const activePage = Math.min(page, totalPages)
  const pageStartIndex = (activePage - 1) * adminPageSize
  const pageRows = filteredRows.slice(pageStartIndex, pageStartIndex + adminPageSize)
  const summary = useMemo(() => buildStatusSummary(rows), [rows])
  const adminMembers = useMemo(
    () => members.filter((member) => normalizeRole(member.ROLES) === 'ADMIN' && member.PIC_TCCD),
    [members],
  )

  function openDetail(row: AdminRow) {
    setSelectedRow(row)
    setDetailValues(createDetailValues(row.request))
    setSelectedPicClaims(cleanText(row.request['PIC#Claims']))
    setParticipants([])
    setShowParticipants(false)
    setRoutingOpen(false)
    setSelectedApprovers([])
    setDetailError(null)
    setRoutingError(null)
    setApprovalChainSteps([])
    setApprovalChainError(null)
    setEditingParticipantId(null)
    setEditParticipantForm(null)
    setIsAddingParticipant(false)
    setNewParticipantForm(emptyParticipantRow())
    setParticipantActionError(null)
    setIsApprovalChainLoading(Boolean(row.tccdNo))
  }

  function closeDetail() {
    setSelectedRow(null)
    setDetailValues(null)
    setParticipants([])
    setShowParticipants(false)
    setRoutingOpen(false)
    setSelectedApprovers([])
    setDetailError(null)
    setRoutingError(null)
    setApprovalChainSteps([])
    setApprovalChainError(null)
    setIsApprovalChainLoading(false)
    setEditingParticipantId(null)
    setEditParticipantForm(null)
    setIsAddingParticipant(false)
    setNewParticipantForm(emptyParticipantRow())
    setParticipantActionError(null)
  }

  async function refreshSelectedRequest(changedFields: Partial<Omit<TCCDWrite, 'ID'>>) {
    if (!selectedRow?.request.ID) {
      setDetailError('Request tidak memiliki ID SharePoint.')
      return
    }

    const updatedRequest: TCCDRead = {
      ...selectedRow.request,
      ...changedFields,
    }
    const updatedRow = mapAdminRow(updatedRequest)

    setRequests((currentRequests) =>
      currentRequests.map((request) => (request.ID === updatedRequest.ID ? updatedRequest : request)),
    )
    setSelectedRow(updatedRow)
    setDetailValues(createDetailValues(updatedRequest))
  }

  async function assignPic() {
    if (!selectedRow || !adminUser || adminUser.role !== 'SUPERADMIN') {
      return
    }

    if (isLockedStatus(selectedRow.status)) {
      setDetailError('Request sudah final, sehingga tidak bisa diedit.')
      return
    }

    const member = adminMembers.find((item) => cleanText(item['PIC_TCCD#Claims']) === selectedPicClaims)

    if (!member?.PIC_TCCD || !member['PIC_TCCD#Claims']) {
      setDetailError('Pilih PIC dari member role ADMIN terlebih dahulu.')
      return
    }

    const updated = await updateSelectedRequest({
      PIC: mapPicToTccdPic(member.PIC_TCCD),
      REQUEST_STATUS: 'Assigned',
      ASSIGN_DATE: new Date().toISOString(),
    })

    if (!updated) {
      return
    }

    // Trigger TCCD Notification Assign flow to notify the new PIC
    if (selectedRow?.request.ID && member.PIC_TCCD?.Email) {
      try {
        const flowResult = await withPowerAppsTimeout(
          TCCDNotificationAssignService.Run({
            number: selectedRow.request.ID,
            text: cleanText(member.PIC_TCCD.Email),
            text_1: 'Assign',
          }),
        )

        if (flowResult?.success) {
          showToast('success', 'PIC berhasil diassign dan notifikasi terkirim ke PIC.')
        } else {
          showToast('info', 'PIC berhasil diassign, tetapi notifikasi flow gagal terkirim.')
        }
      } catch (flowError) {
        console.warn('TCCD Notification Assign flow gagal dipanggil', flowError)
        showToast('info', 'PIC berhasil diassign, tetapi notifikasi flow gagal terkirim.')
      }
    } else {
      showToast('success', 'PIC berhasil diassign.')
    }
  }

  async function rejectRequest() {
    if (!selectedRow || isLockedStatus(selectedRow.status)) {
      setDetailError('Request sudah final, sehingga tidak bisa diedit.')
      return
    }

    const updated = await updateSelectedRequest({
      REQUEST_STATUS: 'Rejected',
    })

    if (!updated) {
      return
    }

    // Trigger TCCD Notification Assign flow to notify the requestor
    if (selectedRow?.request.ID && selectedRow.requestorEmail) {
      try {
        const flowResult = await withPowerAppsTimeout(
          TCCDNotificationAssignService.Run({
            number: selectedRow.request.ID,
            text: cleanText(selectedRow.requestorEmail),
            text_1: 'Reject',
          }),
        )

        if (flowResult?.success) {
          showToast('success', 'Request berhasil direject dan notifikasi terkirim ke requestor.')
        } else {
          showToast('info', 'Request berhasil direject, tetapi notifikasi flow gagal terkirim.')
        }
      } catch (flowError) {
        console.warn('TCCD Notification Assign flow gagal dipanggil saat reject', flowError)
        showToast('info', 'Request berhasil direject, tetapi notifikasi flow gagal terkirim.')
      }
    } else {
      showToast('success', 'Request berhasil direject.')
    }
  }

  async function updateSelectedRequest(changedFields: Partial<Omit<TCCDWrite, 'ID'>>): Promise<boolean> {
    if (!selectedRow?.request.ID) {
      setDetailError('Request tidak memiliki ID SharePoint.')
      return false
    }

    setIsSaving(true)
    setDetailError(null)

    try {
      validateStatusTransition(selectedRow.status, changedFields.REQUEST_STATUS)
      const result = await withPowerAppsTimeout(TCCDService.update(String(selectedRow.request.ID), changedFields))

      if (!result.success) {
        throw new Error(
          result.error
            ? `Gagal mengupdate request: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`
            : 'Gagal mengupdate request. Silakan coba lagi.',
        )
      }

      await refreshSelectedRequest(changedFields)
      return true
    } catch (caughtError) {
      setDetailError(getPowerAppsErrorMessage(caughtError, 'Request belum bisa diupdate'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function viewParticipants() {
    if (!selectedRow?.tccdNo) {
      setDetailError('TCCD_NO belum tersedia untuk request ini.')
      return
    }

    setShowParticipants(true)
    setRoutingOpen(false)
    setIsParticipantsLoading(true)
    setDetailError(null)
    setParticipantActionError(null)
    setEditingParticipantId(null)
    setEditParticipantForm(null)
    setIsAddingParticipant(false)

    try {
      const participantRows = await getParticipantsForRequest(selectedRow.tccdNo)
      setParticipants(participantRows)
    } catch (caughtError) {
      setParticipants([])
      setDetailError(getPowerAppsErrorMessage(caughtError, 'Participant belum bisa dimuat'))
    } finally {
      setIsParticipantsLoading(false)
    }
  }

  function startEditParticipant(participant: TCCDPARTICIPANTSRead) {
    setEditingParticipantId(String(participant.ID ?? ''))
    setEditParticipantForm({
      sn: cleanText(participant.SN),
      name: cleanText(participant.NAME),
      division: cleanText(participant.DIVISION),
      siteArea: cleanText(participant.SITE_AREA),
      employeeStatus: cleanText(participant.EMPLOYEE_STATUS),
      email: cleanText(participant.EMAIL),
      serviceYear: cleanText(participant.SERVICE_YEAR),
    })
    setParticipantActionError(null)
    setIsAddingParticipant(false)
  }


  function cancelEditParticipant() {
    setEditingParticipantId(null)
    setEditParticipantForm(null)
    setParticipantActionError(null)
  }

  function updateEditParticipantField(field: keyof ParticipantEditRow, value: string) {
    setEditParticipantForm((current) => {
      if (!current) return current

      if (field !== 'sn') {
        return { ...current, [field]: value }
      }

      return applyParticipantLookup(current, value, employeeLookup)
    })
  }

  async function saveParticipant() {
    if (!editingParticipantId || !editParticipantForm) {
      return
    }

    setIsParticipantSaving(true)
    setParticipantActionError(null)

    try {
      const participantUpdateResult = await withPowerAppsTimeout(
        TCCDPARTICIPANTSService.update(editingParticipantId, buildParticipantWritePayload(editParticipantForm)),
      )

      if (!participantUpdateResult.success) {
        throw new Error(
          participantUpdateResult.error
            ? `Gagal mengupdate participant: ${typeof participantUpdateResult.error === 'string' ? participantUpdateResult.error : JSON.stringify(participantUpdateResult.error)}`
            : 'Gagal mengupdate participant. Silakan coba lagi.',
        )
      }

      setParticipants((current) =>
        current.map((p) =>
          String(p.ID) === editingParticipantId
            ? { ...p, SN: editParticipantForm.sn, NAME: editParticipantForm.name, DIVISION: editParticipantForm.division, SITE_AREA: editParticipantForm.siteArea, EMPLOYEE_STATUS: editParticipantForm.employeeStatus, EMAIL: editParticipantForm.email, SERVICE_YEAR: editParticipantForm.serviceYear }
            : p,
        ),
      )
      setEditingParticipantId(null)
      setEditParticipantForm(null)
      showToast('success', 'Participant berhasil diupdate.')
    } catch (caughtError) {
      setParticipantActionError(getPowerAppsErrorMessage(caughtError, 'Participant gagal diupdate'))
    } finally {
      setIsParticipantSaving(false)
    }
  }

  async function deleteParticipant(participantId: string) {
    if (!participantId) {
      return
    }

    setIsParticipantSaving(true)
    setParticipantActionError(null)

    try {
      await withPowerAppsTimeout(TCCDPARTICIPANTSService.delete(participantId))

      setParticipants((current) => current.filter((p) => String(p.ID) !== participantId))
      if (editingParticipantId === participantId) {
        setEditingParticipantId(null)
        setEditParticipantForm(null)
      }
      showToast('success', 'Participant berhasil dihapus.')
    } catch (caughtError) {
      setParticipantActionError(getPowerAppsErrorMessage(caughtError, 'Participant gagal dihapus'))
    } finally {
      setIsParticipantSaving(false)
    }
  }

  function startAddParticipant() {
    setIsAddingParticipant(true)
    setNewParticipantForm(emptyParticipantRow())
    setParticipantActionError(null)
    setEditingParticipantId(null)
    setEditParticipantForm(null)
  }

  function cancelAddParticipant() {
    setIsAddingParticipant(false)
    setNewParticipantForm(emptyParticipantRow())
    setParticipantActionError(null)
  }

  function updateNewParticipantField(field: keyof ParticipantEditRow, value: string) {
    setNewParticipantForm((current) => {
      if (field !== 'sn') {
        return { ...current, [field]: value }
      }

      return applyParticipantLookup(current, value, employeeLookup)
    })
  }

  async function saveNewParticipant() {
    if (!selectedRow?.tccdNo) {
      setParticipantActionError('TCCD_NO belum tersedia.')
      return
    }

    setIsParticipantSaving(true)
    setParticipantActionError(null)

    try {
      const payload = {
        ...buildParticipantWritePayload(newParticipantForm),
        TCCD_NO: selectedRow.tccdNo,
      } as Partial<Omit<import('./generated/models/TCCDPARTICIPANTSModel').TCCDPARTICIPANTSWrite, 'ID'>>

      const result = await withPowerAppsTimeout(
        TCCDPARTICIPANTSService.create(payload),
        20000,
      )

      if (!result.success) {
        throw new Error(
          result.error
            ? `Gagal menambah participant: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`
            : 'Gagal menambah participant. Silakan coba lagi.',
        )
      }

      if (result.data) {
        setParticipants((current) => [...current, result.data as TCCDPARTICIPANTSRead])
      }

      setIsAddingParticipant(false)
      setNewParticipantForm(emptyParticipantRow())
      showToast('success', 'Participant berhasil ditambahkan.')
    } catch (caughtError) {
      setParticipantActionError(getPowerAppsErrorMessage(caughtError, 'Participant gagal ditambahkan'))
    } finally {
      setIsParticipantSaving(false)
    }
  }

  async function openRoutingPanel() {
    if (selectedRow && !canEditApprovalRouting(selectedRow.status)) {
      setRoutingError('Approval routing tidak bisa diedit setelah request masuk Waiting Approval atau status final.')
      return
    }

    setRoutingOpen(true)
    setShowParticipants(false)
    setRoutingError(null)

    if (!selectedRow?.tccdNo) {
      setRoutingError('TCCD_NO belum tersedia untuk routing approval.')
      return
    }

    setIsApproversLoading(true)

    try {
      const masterApprovers = approvers.length > 0 ? approvers : await getRoutingApprovers()
      const existingRoutingRows = await getApprovalRoutingRows(selectedRow.tccdNo)
      const mergedApprovers = mergeApprovers(masterApprovers, mapApprovalRowsToApprovers(existingRoutingRows))

      setApprovers(mergedApprovers)
      setSelectedApprovers(mapApprovalRowsToApprovers(existingRoutingRows, mergedApprovers))
    } catch (caughtError) {
      if (approvers.length === 0) {
        setApprovers([])
      }
      setSelectedApprovers([])
      setRoutingError(getPowerAppsErrorMessage(caughtError, 'List approver belum bisa dimuat'))
    } finally {
      setIsApproversLoading(false)
    }
  }

  function toggleApprover(approver: RoutingApprover) {
    setSelectedApprovers((currentApprovers) => {
      const exists = currentApprovers.some((item) => item.id === approver.id)

      if (exists) {
        return currentApprovers.filter((item) => item.id !== approver.id)
      }

      return mergeApprovers(currentApprovers, [approver])
    })
  }

  function moveApprover(fromIndex: number, toIndex: number) {
    setSelectedApprovers((currentApprovers) => {
      const nextApprovers = [...currentApprovers]
      const [movedApprover] = nextApprovers.splice(fromIndex, 1)

      if (!movedApprover) {
        return currentApprovers
      }

      nextApprovers.splice(toIndex, 0, movedApprover)
      return nextApprovers
    })
  }

  async function submitRouting() {
    if (!selectedRow?.tccdNo) {
      setRoutingError('TCCD_NO belum tersedia untuk routing approval.')
      return
    }

    if (!canEditApprovalRouting(selectedRow.status)) {
      setRoutingError('Approval routing tidak bisa diedit setelah request masuk Waiting Approval atau status final.')
      return
    }

    if (selectedApprovers.length === 0) {
      setRoutingError('Pilih minimal satu approver.')
      return
    }

    setIsRoutingSaving(true)
    setRoutingError(null)

    try {
      const uniqueApprovers = dedupeApprovers(selectedApprovers)
      const existingRoutingRows = await getApprovalRoutingRows(selectedRow.tccdNo)

      for (const existingRoutingRow of existingRoutingRows) {
        if (existingRoutingRow.ID) {
          await withPowerAppsTimeout(ApprovalFlowTCCDService.delete(String(existingRoutingRow.ID)))
        }
      }

      for (const [index, approver] of uniqueApprovers.entries()) {
        const payload = buildApprovalRoutingPayload(selectedRow.tccdNo, approver, index + 1)

        console.info('ApprovalFlowTCCD create payload', payload)

        try {
          const approvalFlowResult = await withPowerAppsTimeout(ApprovalFlowTCCDService.create(payload))

          if (!approvalFlowResult.success) {
            throw new Error(
              approvalFlowResult.error
                ? `Gagal membuat approval routing: ${typeof approvalFlowResult.error === 'string' ? approvalFlowResult.error : JSON.stringify(approvalFlowResult.error)}`
                : 'Gagal membuat approval routing. Silakan coba lagi.',
            )
          }
        } catch (createError) {
          const fallbackPayload = buildApprovalRoutingPayload(selectedRow.tccdNo, approver, index + 1, {
            includeStatus: false,
            useFullPersonObject: true,
          })

          console.warn('ApprovalFlowTCCD primary payload failed, retrying fallback payload', {
            error: createError,
            payload: fallbackPayload,
          })

          const fallbackResult = await withPowerAppsTimeout(ApprovalFlowTCCDService.create(fallbackPayload))

          if (!fallbackResult.success) {
            throw new Error(
              fallbackResult.error
                ? `Gagal membuat approval routing (fallback): ${typeof fallbackResult.error === 'string' ? fallbackResult.error : JSON.stringify(fallbackResult.error)}`
                : 'Gagal membuat approval routing. Silakan coba lagi.',
            )
          }
        }
      }

      setRoutingOpen(false)
      setSelectedApprovers(uniqueApprovers)
      if (selectedRow.tccdNo) {
        const steps = await getApprovalChainSteps(selectedRow.tccdNo)
        setApprovalChainSteps(hydrateApprovalStepPhotos(steps, uniqueApprovers))
      }
      showToast('success', 'Approval routing berhasil disimpan.')
    } catch (caughtError) {
      setRoutingError(getPowerAppsErrorMessage(caughtError, 'Approval routing belum bisa disimpan'))
    } finally {
      setIsRoutingSaving(false)
    }
  }

  async function runApproval() {
    if (!selectedRow?.tccdNo) {
      setDetailError('TCCD_NO belum tersedia untuk menjalankan approval.')
      return
    }

    const approvalRunKey = getApprovalRunKey(selectedRow)

    if (approvalRunLocks.has(approvalRunKey) || normalizeStatus(selectedRow.status) === 'waiting approval') {
      showToast('info', 'Approval untuk request ini sudah dijalankan.')
      return
    }

    if (isLockedStatus(selectedRow.status)) {
      setDetailError('Request sudah final, sehingga approval tidak bisa dijalankan.')
      return
    }

    setIsFlowRunning(true)
    setDetailError(null)

    try {
      await runApprovalTccdFlow(selectedRow)
      setApprovalRunLocks((currentLocks) => {
        const nextLocks = new Set(currentLocks)
        nextLocks.add(approvalRunKey)
        return nextLocks
      })
      showToast('success', 'Approval TCCD berhasil dijalankan.')
      await updateSelectedRequest({
        REQUEST_STATUS: 'Waiting Approval',
        PROCESS_DATE: new Date().toISOString(),
      })
      setRoutingOpen(false)
    } catch (caughtError) {
      setDetailError(getPowerAppsErrorMessage(caughtError, 'Approval flow belum bisa dijalankan'))
    } finally {
      setIsFlowRunning(false)
    }
  }

  async function submitAndRunApproval() {
    if (!detailValues || !selectedRow) {
      return
    }

    if (isLockedStatus(selectedRow.status)) {
      setDetailError('Request sudah final, sehingga tidak bisa diajukan approval.')
      return
    }

    if (normalizeStatus(selectedRow.status) === 'waiting approval') {
      showToast('info', 'Approval untuk request ini sudah berjalan.')
      return
    }

    const saved = await updateSelectedRequest({
      COURSE_TITLE: detailValues.courseTitle.trim(),
      Title: detailValues.courseTitle.trim(),
      PLANNING_DATE: detailValues.planningDate,
      TYPE_OF_REQUEST: detailValues.requestType,
      JUSTIFICATION: detailValues.justification.trim(),
      OBJECTIVE: detailValues.objective.trim(),
      NUMBER_PARTICIPANT: parseOptionalNumber(detailValues.participantCount),
      PROVIDER: detailValues.learningImplement,
      NOTE: detailValues.note.trim(),
      BUDGET: detailValues.budget,
      EXPENSE_CATEGORY: detailValues.expenseCategory,
      VENDOR_NAME: detailValues.vendorName.trim(),
      TYPE_OF_LEARNING: detailValues.typeOfLearning,
      TOTAL_EXPENSES: parseOptionalNumber(detailValues.totalExpense),
    })

    if (!saved) {
      return
    }

    await runApproval()
  }

  async function closeRequest() {
    if (!selectedRow) {
      return
    }

    if (isLockedStatus(selectedRow.status)) {
      setDetailError('Request sudah final, sehingga tidak bisa ditutup.')
      return
    }

    if (normalizeStatus(selectedRow.status) !== 'fully approved') {
      setDetailError('Request hanya bisa ditutup setelah berstatus Fully Approved.')
      return
    }

    const updated = await updateSelectedRequest({
      REQUEST_STATUS: 'Closed',
    })

    if (updated) {
      showToast('success', 'Request berhasil ditutup.')
    }
  }

  if (isLoading) {
    return (
      <section className="admin-page section-container">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <div className="admin-state-card">Memverifikasi akses Portal Admin...</div>
      </section>
    )
  }

  if (error || !adminUser) {
    return (
      <section className="admin-page section-container">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <div className="admin-denied-card">
          <span>Akses ditolak</span>
          <h1>Portal Admin hanya untuk member TCCD.</h1>
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page section-container">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="admin-hero">
        <div>
          <h1>Portal Admin TCCD</h1>
          <p>Kelola assignment PIC, detail request, participant, dan routing approval.</p>
          <span className="request-scope">
            {adminUser.name} - {adminUser.role}
          </span>
        </div>
        <div className="admin-hero-actions">
          <button
            type="button"
            className="refresh-data-button"
            onClick={refreshAdminData}
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

      <div className="admin-summary-grid">
        {adminStatusConfigs.map((status) => (
          <DashboardCard
            key={status.label}
            config={status}
            value={summary[status.label] ?? 0}
            isActive={activeStatus === status.label}
            onClick={() => {
              setPage(1)
              setActiveStatus((currentStatus) => (currentStatus === status.label ? null : status.label))
            }}
          />
        ))}
      </div>

      <div className="admin-toolbar">
        <label className="search-field">
          <span>Cari</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Cari requestor, training title, PIC, TCCD No"
          />
        </label>
        <div className="admin-filter-state">
          <span>{activeStatus ? `Filter status: ${activeStatus}` : 'Semua status'}</span>
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

      <TccdAdminTable
        rows={pageRows}
        filteredRowsCount={filteredRows.length}
        totalRows={rows.length}
        onRowClick={openDetail}
      />

      {!isLoading && !error && filteredRows.length > 0 ? (
        <div className="pagination-bar" aria-label="Pagination data request admin">
          <span>
            Menampilkan {pageStartIndex + 1}-{Math.min(pageStartIndex + pageRows.length, filteredRows.length)} dari{' '}
            {filteredRows.length} request
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

      {selectedRow && detailValues ? (
        <AdminDetailPanel
          row={selectedRow}
          role={adminUser.role}
          adminMembers={adminMembers}
          selectedPicClaims={selectedPicClaims}
          detailValues={detailValues}
          participants={participants}
          showParticipants={showParticipants}
          isParticipantsLoading={isParticipantsLoading}
          editingParticipantId={editingParticipantId}
          editParticipantForm={editParticipantForm}
          isAddingParticipant={isAddingParticipant}
          newParticipantForm={newParticipantForm}
          isParticipantSaving={isParticipantSaving}
          participantActionError={participantActionError}
          isSaving={isSaving}
          detailError={detailError}
          onStartEditParticipant={startEditParticipant}
          onCancelEditParticipant={cancelEditParticipant}
          onUpdateEditParticipantField={updateEditParticipantField}
          onSaveParticipant={() => void saveParticipant()}
          onDeleteParticipant={(id) => void deleteParticipant(id)}
          onStartAddParticipant={startAddParticipant}
          onCancelAddParticipant={cancelAddParticipant}
          onUpdateNewParticipantField={updateNewParticipantField}
          onSaveNewParticipant={() => void saveNewParticipant()}
          approvalChainSteps={approvalChainSteps}
          isApprovalChainLoading={isApprovalChainLoading}
          approvalChainError={approvalChainError}
          routingOpen={routingOpen}
          approvers={approvers}
          selectedApprovers={selectedApprovers}
          isApproversLoading={isApproversLoading}
          isRoutingSaving={isRoutingSaving}
          isFlowRunning={isFlowRunning}
          routingError={routingError}
          onClose={closeDetail}
          onSelectedPicChange={setSelectedPicClaims}
          onAssignPic={() => void assignPic()}
          onReject={() => void rejectRequest()}
          onDetailValueChange={(field, value) =>
            setDetailValues((currentValues) => (currentValues ? { ...currentValues, [field]: value } : currentValues))
          }
          onSubmitAndRunApproval={() => void submitAndRunApproval()}
          onViewParticipants={() => void viewParticipants()}
          onOpenRouting={() => void openRoutingPanel()}
          onCloseRequest={() => void closeRequest()}
          onCloseParticipants={() => {
            setShowParticipants(false)
            setEditingParticipantId(null)
            setEditParticipantForm(null)
            setIsAddingParticipant(false)
            setParticipantActionError(null)
          }}
          onCloseRouting={() => setRoutingOpen(false)}
          onToggleApprover={toggleApprover}
          onMoveApprover={moveApprover}
          onSubmitRouting={() => void submitRouting()}
        />
      ) : null}
    </section>
  )
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-notification toast-notification-${toast.type}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Tutup notifikasi">
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

function DashboardCard({
  config,
  value,
  isActive,
  onClick,
}: {
  config: AdminStatusConfig
  value: number
  isActive: boolean
  onClick: () => void
}) {
  const Icon = config.icon

  return (
    <button
      type="button"
      className={`admin-summary-card admin-summary-card-${config.tone} ${
        isActive ? 'admin-summary-card-active' : ''
      }`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <span className="admin-summary-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <span>{config.label}</span>
      <strong>{value}</strong>
    </button>
  )
}

function TccdAdminTable({
  rows,
  filteredRowsCount,
  totalRows,
  onRowClick,
}: {
  rows: AdminRow[]
  filteredRowsCount: number
  totalRows: number
  onRowClick: (row: AdminRow) => void
}) {
  return (
    <div className="request-table-wrap admin-table-wrap">
      <div className="admin-table-meta">
        <span>
          Menampilkan {rows.length} dari {filteredRowsCount} request
          {filteredRowsCount !== totalRows ? ` (${totalRows} total)` : ''}
        </span>
      </div>
      <table className="request-table">
        <thead>
          <tr>
            <th>TCCD No</th>
            <th>Judul Training</th>
            <th>Requestor</th>
            <th>PIC</th>
            <th className="table-heading-center">Tanggal Request</th>
            <th className="table-heading-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="table-message" colSpan={6}>
                Data TCCD tidak ditemukan untuk filter ini.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="request-row"
                tabIndex={0}
                role="button"
                onClick={() => onRowClick(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(row)
                  }
                }}
              >
                <td data-label="TCCD No">{row.tccdNo || '-'}</td>
                <td data-label="Judul Training">
                  <strong>{row.title}</strong>
                </td>
                <td data-label="Requestor">{row.requestorName || '-'}</td>
                <td data-label="PIC">{row.picName || '-'}</td>
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
  )
}

const workflowStages = [
  { key: 'waiting assign', label: 'Waiting Assign', icon: Hourglass },
  { key: 'assigned', label: 'Assigned', icon: UserCheck },
  { key: 'waiting approval', label: 'Waiting Approval', icon: Send },
  { key: 'fully approved', label: 'Fully Approved', icon: CheckCircle2 },
  { key: 'closed', label: 'Closed', icon: ClipboardCheck },
] as const

function getWorkflowStageIndex(status: string) {
  const normalizedStatus = normalizeStatus(status)

  if (normalizedStatus === 'rejected' || normalizedStatus === 'cancelled') {
    return 3
  }

  return workflowStages.findIndex((stage) => stage.key === normalizedStatus)
}

function WorkflowStepper({ status }: { status: string }) {
  const normalizedStatus = normalizeStatus(status)
  const currentIndex = getWorkflowStageIndex(status)
  const terminalVariant = normalizedStatus === 'rejected' || normalizedStatus === 'cancelled'

  return (
    <div className="workflow-stepper" aria-label="Tahapan workflow pengajuan">
      {workflowStages.map((stage, index) => {
        const Icon = stage.icon
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
        let label: string = stage.label
        if (index === 3 && normalizedStatus === 'rejected') label = 'Rejected'
        if (index === 3 && normalizedStatus === 'cancelled') label = 'Cancelled'
        const isTerminal = terminalVariant && index === 3

        return (
          <div
            key={stage.key}
            className={`workflow-step workflow-step-${state}${isTerminal ? ' workflow-step-terminal' : ''}`}
          >
            <div className="workflow-step-rail">
              <span className="workflow-step-dot">
                {state === 'done' ? <Check size={14} strokeWidth={3} /> : <Icon size={15} strokeWidth={2.4} />}
              </span>
              {index < workflowStages.length - 1 ? <span className="workflow-step-line" /> : null}
            </div>
            <span className="workflow-step-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function AdminDetailPanel({
  row,
  role,
  adminMembers,
  selectedPicClaims,
  detailValues,
  participants,
  showParticipants,
  isParticipantsLoading,
  editingParticipantId,
  editParticipantForm,
  isAddingParticipant,
  newParticipantForm,
  isParticipantSaving,
  participantActionError,
  isSaving,
  detailError,
  approvalChainSteps,
  isApprovalChainLoading,
  approvalChainError,
  routingOpen,
  approvers,
  selectedApprovers,
  isApproversLoading,
  isRoutingSaving,
  isFlowRunning,
  routingError,
  onClose,
  onSelectedPicChange,
  onAssignPic,
  onReject,
  onDetailValueChange,
  onViewParticipants,
  onStartEditParticipant,
  onCancelEditParticipant,
  onUpdateEditParticipantField,
  onSaveParticipant,
  onDeleteParticipant,
  onStartAddParticipant,
  onCancelAddParticipant,
  onUpdateNewParticipantField,
  onSaveNewParticipant,
  onOpenRouting,
  onSubmitAndRunApproval,
  onCloseRequest,
  onCloseParticipants,
  onCloseRouting,
  onToggleApprover,
  onMoveApprover,
  onSubmitRouting,
}: {
  row: AdminRow
  role: AdminRole
  adminMembers: MemberTCCDRead[]
  selectedPicClaims: string
  detailValues: AdminDetailValues
  participants: TCCDPARTICIPANTSRead[]
  showParticipants: boolean
  isParticipantsLoading: boolean
  editingParticipantId: string | null
  editParticipantForm: ParticipantEditRow | null
  isAddingParticipant: boolean
  newParticipantForm: ParticipantEditRow
  isParticipantSaving: boolean
  participantActionError: string | null
  isSaving: boolean
  detailError: string | null
  approvalChainSteps: ApproverStep[]
  isApprovalChainLoading: boolean
  approvalChainError: string | null
  routingOpen: boolean
  approvers: RoutingApprover[]
  selectedApprovers: RoutingApprover[]
  isApproversLoading: boolean
  isRoutingSaving: boolean
  isFlowRunning: boolean
  routingError: string | null
  onClose: () => void
  onSelectedPicChange: (value: string) => void
  onAssignPic: () => void
  onReject: () => void
  onDetailValueChange: (field: keyof AdminDetailValues, value: string) => void
  onViewParticipants: () => void
  onStartEditParticipant: (participant: TCCDPARTICIPANTSRead) => void
  onCancelEditParticipant: () => void
  onUpdateEditParticipantField: (field: keyof ParticipantEditRow, value: string) => void
  onSaveParticipant: () => void
  onDeleteParticipant: (id: string) => void
  onStartAddParticipant: () => void
  onCancelAddParticipant: () => void
  onUpdateNewParticipantField: (field: keyof ParticipantEditRow, value: string) => void
  onSaveNewParticipant: () => void
  onOpenRouting: () => void
  onSubmitAndRunApproval: () => void
  onCloseRequest: () => void
  onCloseParticipants: () => void
  onCloseRouting: () => void
  onToggleApprover: (approver: RoutingApprover) => void
  onMoveApprover: (fromIndex: number, toIndex: number) => void
  onSubmitRouting: () => void
}) {
  const isLocked = isLockedStatus(row.status)
  const rank = getStatusRank(row.status)
  const stage = getWorkflowStageIndex(row.status)
  const canEditDetails = !isLocked && (rank === null || rank < 3)
  const hasRouting = approvalChainSteps.length > 0
  const isWaitingAssign = stage === 0
  const isAssigned = stage === 1
  const isWaitingApproval = stage === 2
  const isApproved = stage === 3 && normalizeStatus(row.status) === 'fully approved'

  let stageHint = ''
  if (isLocked) {
    stageHint = 'Request sudah berstatus final. Semua fitur edit terkunci.'
  } else if (isWaitingAssign) {
    stageHint =
      role === 'SUPERADMIN'
        ? 'Langkah ini: pilih PIC admin lalu klik Assign untuk meneruskan request.'
        : 'Langkah ini: menunggu superadmin menunjuk PIC admin yang akan memproses request.'
  } else if (isAssigned) {
    stageHint =
      role === 'ADMIN'
        ? hasRouting
          ? 'Langkah ini: lengkapi detail request, lalu klik "Simpan & Ajukan Approval".'
          : 'Langkah ini: atur approval routing (pilih approver & urutan) sebelum mengajukan approval.'
        : 'Request sedang diproses oleh PIC admin.'
  } else if (isWaitingApproval) {
    stageHint = 'Langkah ini: menunggu seluruh approver memberikan persetujuan. Status berubah otomatis oleh flow.'
  } else if (isApproved) {
    stageHint = 'Semua approver menyetujui. Tutup request setelah pelaksanaan selesai.'
  }

  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="request-detail-panel admin-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Admin detail ${row.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-panel-header">
          <div>
            <span className="detail-kicker">{row.tccdNo || 'TCCD request'}</span>
            <h3>{row.title}</h3>
          </div>
          <button type="button" className="detail-close-button" onClick={onClose} aria-label="Tutup detail">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <WorkflowStepper status={row.status} />

        {stageHint ? (
          <div className="stage-hint">
            <HelpCircle size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{stageHint}</span>
          </div>
        ) : null}

        <div className="detail-summary">
          <div className="admin-detail-summary">
            <span>PIC</span>
            <strong>{row.picName || 'Belum diassign'}</strong>
          </div>
          <span className={getStatusClassName(row.status)}>{getStatusDisplayLabel(row.status)}</span>
        </div>

        {isLocked ? (
          <div className="detail-empty-state">Request sudah berstatus final, semua fitur edit dikunci.</div>
        ) : null}

        {(isWaitingAssign || isAssigned) && role === 'SUPERADMIN' ? (
          <div className="admin-action-panel">
            <label className="detail-edit-field">
              <span>Assign PIC</span>
              <select
                value={selectedPicClaims}
                onChange={(event) => onSelectedPicChange(event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="">Pilih PIC admin</option>
                {adminMembers.map((member) => (
                  <option key={member.ID ?? member['PIC_TCCD#Claims']} value={cleanText(member['PIC_TCCD#Claims'])}>
                    {member.PIC_TCCD?.DisplayName || member.Title || member.PIC_TCCD?.Email}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-inline-actions">
              <button
                type="button"
                className="detail-primary-action"
                onClick={onAssignPic}
                disabled={isSaving || !canEditDetails}
              >
                {isSaving ? 'Memproses...' : 'Assign'}
              </button>
              <button
                type="button"
                className="detail-danger-action"
                onClick={onReject}
                disabled={isSaving || !canEditDetails}
              >
                Reject
              </button>
            </div>
          </div>
        ) : null}

        {isAssigned && role === 'ADMIN' ? (
          <div className="admin-action-panel">
            {hasRouting ? (
              <>
                <div className="stage-action-copy-block">
                  <strong>Request siap diajukan</strong>
                  <p>Klik tombol untuk menyimpan seluruh perubahan dan menjalankan approval.</p>
                </div>
                <div className="admin-inline-actions">
                  <button
                    type="button"
                    className="detail-primary-action"
                    onClick={onSubmitAndRunApproval}
                    disabled={isSaving || isFlowRunning || !canEditDetails}
                  >
                    {isFlowRunning ? 'Menjalankan Approval...' : 'Simpan & Ajukan Approval'}
                  </button>
                  <button
                    type="button"
                    className="detail-secondary-action"
                    onClick={onOpenRouting}
                    disabled={isSaving || !canEditDetails}
                  >
                    Ubah Routing
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="stage-action-copy-block">
                  <strong>Approval routing belum diatur</strong>
                  <p>Pilih approver dan urutan persetujuan sebelum mengajukan approval.</p>
                </div>
                <div className="admin-inline-actions">
                  <button
                    type="button"
                    className="detail-primary-action"
                    onClick={onOpenRouting}
                    disabled={isSaving || !canEditDetails}
                  >
                    Atur Approval Routing
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {isApproved ? (
          <div className="admin-action-panel">
            <div className="stage-action-copy-block">
              <strong>Request sudah disetujui</strong>
              <p>Tutup request setelah pelaksanaan training/sertifikasi selesai.</p>
            </div>
            <div className="admin-inline-actions">
              <button type="button" className="detail-primary-action" onClick={onCloseRequest} disabled={isSaving}>
                {isSaving ? 'Memproses...' : 'Tutup Request'}
              </button>
            </div>
          </div>
        ) : null}

        {detailError ? <div className="detail-empty-state detail-error-state">{detailError}</div> : null}

        <div className="admin-detail-section">
          <div className="admin-section-heading">
            <h4>Request Details</h4>
            <p>Lengkapi informasi request. Perubahan tersimpan saat klik "Simpan & Ajukan Approval".</p>
          </div>
          <div className="detail-edit-grid">
            <label className="detail-edit-field">
              <span>Course Title</span>
              <input
                type="text"
                value={detailValues.courseTitle}
                onChange={(event) => onDetailValueChange('courseTitle', event.target.value)}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field">
              <span>Planning Date</span>
              <input
                type="date"
                value={detailValues.planningDate}
                onChange={(event) => onDetailValueChange('planningDate', event.target.value)}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field">
              <span>Type of Request</span>
              <select
                value={detailValues.requestType}
                onChange={(event) => onDetailValueChange('requestType', event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="training">Training</option>
                <option value="certification">Certification</option>
              </select>
            </label>
            <label className="detail-edit-field">
              <span>Learning Implement</span>
              <select
                value={detailValues.learningImplement}
                onChange={(event) => onDetailValueChange('learningImplement', event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="internal">Internal</option>
                <option value="eksternal">External</option>
              </select>
            </label>
            <label className="detail-edit-field">
              <span>Number Participant</span>
              <input
                type="number"
                min="0"
                value={detailValues.participantCount}
                onChange={(event) => onDetailValueChange('participantCount', event.target.value)}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field">
              <span>Total Expense</span>
              <input
                type="number"
                min="0"
                value={detailValues.totalExpense}
                onChange={(event) => onDetailValueChange('totalExpense', event.target.value)}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field">
              <span>Budget</span>
              <select
                value={detailValues.budget}
                onChange={(event) => onDetailValueChange('budget', event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="">Pilih budget</option>
                <option value="Budget">Budget</option>
                <option value="Non Budgeted">Non Budgeted</option>
              </select>
            </label>
            <label className="detail-edit-field">
              <span>Expense Category</span>
              <select
                value={detailValues.expenseCategory}
                onChange={(event) => onDetailValueChange('expenseCategory', event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="">Pilih kategori</option>
                <option value="<10 Juta">&lt;10 Juta</option>
                <option value="10-25 Juta">10-25 Juta</option>
                <option value=">50 Juta">&gt;50 Juta</option>
              </select>
            </label>
            <label className="detail-edit-field">
              <span>Vendor Name</span>
              <input
                type="text"
                value={detailValues.vendorName}
                onChange={(event) => onDetailValueChange('vendorName', event.target.value)}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field">
              <span>Type of Learning</span>
              <select
                value={detailValues.typeOfLearning}
                onChange={(event) => onDetailValueChange('typeOfLearning', event.target.value)}
                disabled={isSaving || !canEditDetails}
              >
                <option value="">Pilih type</option>
                {learningOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="detail-edit-field detail-edit-field-wide">
              <span>Justification</span>
              <textarea
                value={detailValues.justification}
                onChange={(event) => onDetailValueChange('justification', event.target.value)}
                rows={4}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field detail-edit-field-wide">
              <span>Objective</span>
              <textarea
                value={detailValues.objective}
                onChange={(event) => onDetailValueChange('objective', event.target.value)}
                rows={4}
                disabled={isSaving || !canEditDetails}
              />
            </label>
            <label className="detail-edit-field detail-edit-field-wide">
              <span>Note</span>
              <textarea
                value={detailValues.note}
                onChange={(event) => onDetailValueChange('note', event.target.value)}
                rows={3}
                disabled={isSaving || !canEditDetails}
              />
            </label>
          </div>
        </div>

        <div className="detail-actions admin-detail-actions">
          <button type="button" className="detail-secondary-action" onClick={onViewParticipants} disabled={isSaving}>
            View Participant
          </button>
        </div>

        <ApprovalChain
          steps={approvalChainSteps}
          isLoading={isApprovalChainLoading}
          error={approvalChainError}
        />

      </aside>
      {showParticipants ? (
        <SidePanel
          title="Participant"
          onClose={onCloseParticipants}
          action={
            <button
              type="button"
              className="panel-add-button"
              onClick={onStartAddParticipant}
              disabled={isParticipantSaving || isAddingParticipant || Boolean(editingParticipantId)}
            >
              Add Participant
            </button>
          }
        >
          <ParticipantEditor
            participants={participants}
            isLoading={isParticipantsLoading}
            editingId={editingParticipantId}
            editForm={editParticipantForm}
            isAdding={isAddingParticipant}
            newForm={newParticipantForm}
            isSaving={isParticipantSaving}
            actionError={participantActionError}
            onEdit={onStartEditParticipant}
            onCancelEdit={onCancelEditParticipant}
            onUpdateEditField={onUpdateEditParticipantField}
            onSave={onSaveParticipant}
            onDelete={onDeleteParticipant}
            onCancelAdd={onCancelAddParticipant}
            onUpdateNewField={onUpdateNewParticipantField}
            onSaveNew={onSaveNewParticipant}
            onStartAdd={onStartAddParticipant}
          />
        </SidePanel>
      ) : null}

      {routingOpen ? (
        <SidePanel title="Approval Routing" onClose={onCloseRouting}>
          <ApprovalRouting
            approvers={approvers}
            selectedApprovers={selectedApprovers}
            isLoading={isApproversLoading}
            isSaving={isRoutingSaving}
            error={routingError}
            onToggleApprover={onToggleApprover}
            onMoveApprover={onMoveApprover}
            onSubmit={onSubmitRouting}
          />
        </SidePanel>
      ) : null}

    </div>
  )
}

function SidePanel({
  title,
  children,
  onClose,
  action,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  action?: ReactNode
}) {
  return (
    <aside className="admin-side-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
      <div className="admin-side-panel-header">
        <h3>{title}</h3>
        <div className="admin-side-panel-actions">
          {action}
          <button type="button" className="detail-close-button" onClick={onClose} aria-label={`Tutup ${title}`}>
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="admin-side-panel-body">{children}</div>
    </aside>
  )
}

function ParticipantEditor({
  participants,
  isLoading,
  editingId,
  editForm,
  isAdding,
  newForm,
  isSaving,
  actionError,
  onEdit,
  onCancelEdit,
  onUpdateEditField,
  onSave,
  onDelete,
  onCancelAdd,
  onUpdateNewField,
  onSaveNew,
  onStartAdd,
}: {
  participants: TCCDPARTICIPANTSRead[]
  isLoading: boolean
  editingId: string | null
  editForm: ParticipantEditRow | null
  isAdding: boolean
  newForm: ParticipantEditRow
  isSaving: boolean
  actionError: string | null
  onEdit: (participant: TCCDPARTICIPANTSRead) => void
  onCancelEdit: () => void
  onUpdateEditField: (field: keyof ParticipantEditRow, value: string) => void
  onSave: () => void
  onDelete: (id: string) => void
  onCancelAdd: () => void
  onUpdateNewField: (field: keyof ParticipantEditRow, value: string) => void
  onSaveNew: () => void
  onStartAdd: () => void
}) {
  return (
    <div className="participant-detail-block">
      <p className="participant-panel-meta">{participants.length} participant terkait request ini.</p>

      {actionError ? (
        <div className="detail-empty-state detail-error-state">{actionError}</div>
      ) : null}

      {isLoading ? (
        <div className="detail-empty-state">Memuat participant...</div>
      ) : participants.length === 0 && !isAdding ? (
        <div className="detail-empty-state participant-empty-state">
          <span>Participant belum ditemukan.</span>
          <button
            type="button"
            className="panel-add-button"
            onClick={onStartAdd}
            disabled={isSaving}
          >
            Add Participant
          </button>
        </div>
      ) : (
        <div className="participant-table-panel">
          <table className="participant-simple-table">
            <thead>
              <tr>
                <th>SN</th>
                <th>Name</th>
                <th>Division</th>
                <th>Site Area</th>
                <th>Status</th>
                <th>Service Year</th>
                <th className="table-heading-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => {
                const id = String(participant.ID ?? '')

                return (
                  <tr key={id}>
                    <td>{cleanText(participant.SN) || '-'}</td>
                    <td><strong>{cleanText(participant.NAME) || '-'}</strong></td>
                    <td>{cleanText(participant.DIVISION) || '-'}</td>
                    <td>{cleanText(participant.SITE_AREA) || '-'}</td>
                    <td>{cleanText(participant.EMPLOYEE_STATUS) || '-'}</td>
                    <td>{cleanText(participant.SERVICE_YEAR) || '-'}</td>
                    <td>
                      <div className="participant-row-actions">
                        <button
                          type="button"
                          className="detail-secondary-action"
                          onClick={() => onEdit(participant)}
                          disabled={isSaving || isAdding || Boolean(editingId)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="detail-danger-action"
                          onClick={() => {
                            if (window.confirm(`Hapus participant ${cleanText(participant.NAME) || participant.SN}?`)) {
                              onDelete(id)
                            }
                          }}
                          disabled={isSaving || isAdding || Boolean(editingId)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {editingId && editForm ? (
            <ParticipantEditPanel
              form={editForm}
              isSaving={isSaving}
              onChange={onUpdateEditField}
              onSave={onSave}
              onCancel={onCancelEdit}
            />
          ) : null}

          {isAdding ? (
            <ParticipantEditPanel
              form={newForm}
              isSaving={isSaving}
              onChange={onUpdateNewField}
              onSave={onSaveNew}
              onCancel={onCancelAdd}
              isNew
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

function ParticipantEditPanel({
  form,
  isSaving,
  onChange,
  onSave,
  onCancel,
  isNew,
}: {
  form: ParticipantEditRow
  isSaving: boolean
  onChange: (field: keyof ParticipantEditRow, value: string) => void
  onSave: () => void
  onCancel: () => void
  isNew?: boolean
}) {
  return (
    <div className="participant-edit-row">
      <div className="participant-edit-fields">
        <input value={form.sn} onChange={(e) => onChange('sn', e.target.value)} placeholder={isNew ? 'Personnel No *' : 'Personnel No'} disabled={isSaving} />
        <input value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder={isNew ? 'Nama *' : 'Nama'} disabled={isSaving} />
        <input value={form.division} onChange={(e) => onChange('division', e.target.value)} placeholder="Division" disabled={isSaving} />
        <input value={form.siteArea} onChange={(e) => onChange('siteArea', e.target.value)} placeholder="Site Area" disabled={isSaving} />
        <input value={form.employeeStatus} onChange={(e) => onChange('employeeStatus', e.target.value)} placeholder="Status" disabled={isSaving} />
        <input value={form.serviceYear} onChange={(e) => onChange('serviceYear', e.target.value)} placeholder="Service Year" disabled={isSaving} />
      </div>
      <div className="participant-edit-actions">
        <button type="button" className="detail-primary-action" onClick={onSave} disabled={isSaving}>
          {isSaving ? '...' : 'Save'}
        </button>
        <button type="button" className="detail-secondary-action" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ApprovalRouting({
  approvers,
  selectedApprovers,
  isLoading,
  isSaving,
  error,
  onToggleApprover,
  onMoveApprover,
  onSubmit,
}: {
  approvers: RoutingApprover[]
  selectedApprovers: RoutingApprover[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onToggleApprover: (approver: RoutingApprover) => void
  onMoveApprover: (fromIndex: number, toIndex: number) => void
  onSubmit: () => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  return (
    <div className="approval-routing-panel">
      <div className="participant-detail-header">
        <div>
          <h4>Approval Routing</h4>
          <p>Pilih approver, lalu atur urutan approval dari preview.</p>
        </div>
      </div>

      {error ? <div className="detail-empty-state detail-error-state">{error}</div> : null}

      <div className="approval-routing-grid">
        <div className="approval-picker">
          {isLoading ? (
            <div className="detail-empty-state">Memuat approver...</div>
          ) : approvers.length === 0 ? (
            <div className="detail-empty-state">Approver belum tersedia.</div>
          ) : (
            approvers.map((approver) => {
              const checked = selectedApprovers.some((item) => item.id === approver.id)

              return (
                <label key={approver.id} className="approval-option">
                  <input type="checkbox" checked={checked} onChange={() => onToggleApprover(approver)} />
                  <span>
                    <strong>{approver.name}</strong>
                    <small>{approver.jobTitle || approver.email}</small>
                  </span>
                </label>
              )
            })
          )}
        </div>

        <div className="approval-preview">
          {selectedApprovers.length === 0 ? (
            <div className="detail-empty-state">Preview sequence akan tampil setelah approver dipilih.</div>
          ) : (
            selectedApprovers.map((approver, index) => (
              <div
                key={approver.id}
                className="approval-preview-row"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    onMoveApprover(dragIndex, index)
                  }
                  setDragIndex(null)
                }}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{approver.name}</strong>
                  <small>{approver.jobTitle || approver.email}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="detail-actions">
        <button type="button" className="detail-primary-action" onClick={onSubmit} disabled={isSaving}>
          {isSaving ? 'Menyimpan routing...' : 'Submit Routing'}
        </button>
      </div>
    </div>
  )
}

function ApprovalChain({
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
          <h4>Approval Progress</h4>
        </div>
        <div className="detail-empty-state">Memuat approval progress...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="participant-detail-block">
        <div className="participant-detail-header">
          <h4>Approval Progress</h4>
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
                  <PersonAvatar name={step.name} photoUrl={step.photoUrl} />
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

function PersonAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const shouldShowImage = Boolean(photoUrl) && !imageFailed

  return (
    <span className="approval-person-avatar" aria-hidden="true">
      {shouldShowImage ? <img src={photoUrl} alt="" onError={() => setImageFailed(true)} /> : getInitials(name)}
    </span>
  )
}

async function getAdminRequests() {
  const result = await withPowerAppsTimeout(
    TCCDService.getAll({
      select: adminTccdColumns,
      top: 500,
      orderBy: ['Created desc'],
    }),
  )

  return Array.isArray(result.data) ? result.data : []
}

async function getParticipantsForRequest(tccdNo: string) {
  const filter = `TCCD_NO eq '${escapeODataValue(tccdNo)}'`
  const result = await withPowerAppsTimeout(
    TCCDPARTICIPANTSService.getAll({
      select: participantColumns,
      filter,
      top: 300,
      orderBy: ['ID asc'],
    }),
  )

  return Array.isArray(result.data) ? result.data : []
}

async function getApprovalChainSteps(tccdNo: string): Promise<ApproverStep[]> {
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
    claims: cleanText(row['Approver_name#Claims']) || cleanText(row.Approver_name?.Claims),
    photoUrl: cleanText(row.Approver_name?.Picture),
    jobTitle: cleanText(row.Department_App) || cleanText(row.Approver_name?.JobTitle) || '-',
    sequence: typeof row.Seq_approval === 'number' ? row.Seq_approval : 0,
    status: cleanText(row.Status_Flow) || 'Waiting',
    date: formatApprovalDate(row.Approval_date),
    comment: cleanText(row.Comment),
  }
}

function hydrateApprovalStepPhotos(steps: ApproverStep[], approvers: RoutingApprover[]) {
  if (approvers.length === 0) {
    return steps
  }

  return steps.map((step) => {
    if (step.photoUrl) {
      return step
    }

    const matchedApprover = approvers.find((approver) => {
      const sameClaims = cleanText(approver.claims).toLowerCase() === cleanText(step.claims).toLowerCase()
      const sameEmail = cleanText(approver.email).toLowerCase() === cleanText(step.email).toLowerCase()
      const sameName = cleanText(approver.name).toLowerCase() === cleanText(step.name).toLowerCase()

      return Boolean((step.claims && sameClaims) || (step.email && sameEmail) || (step.name && sameName))
    })

    return {
      ...step,
      photoUrl: cleanText(matchedApprover?.person?.Picture),
    }
  })
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

async function runApprovalTccdFlow(row: AdminRow) {
  const sharePointId = Number(row.id)

  if (!Number.isFinite(sharePointId) || sharePointId <= 0) {
    throw new Error('ID SharePoint TCCD tidak valid untuk menjalankan Approval TCCD.')
  }

  const result = await ApprovalTCCDService.Run({ number: sharePointId })

  if (!result.success) {
    throw new Error(
      result.error
        ? `Approval TCCD gagal dijalankan: ${result.error.message ?? result.error}`
        : 'Approval TCCD gagal dijalankan.',
    )
  }
}

async function getRoutingApprovers(): Promise<RoutingApprover[]> {
  const result = await withPowerAppsTimeout(
    DivHead_MemberService.getAll({
      select: ['ID', 'Title', 'DIVHEAD_PIC', 'DIVHEAD_PIC#Claims', 'CAT', 'EMAIL'],
      top: 500,
      orderBy: ['ID asc'],
    }),
  )
  const rows = Array.isArray(result.data) ? result.data : []

  return dedupeApprovers(
    rows
    .filter((row) => row.DIVHEAD_PIC && row['DIVHEAD_PIC#Claims'])
    .map((row) => ({
      id: String(row.ID ?? row['DIVHEAD_PIC#Claims']),
      name: cleanText(row.DIVHEAD_PIC?.DisplayName) || cleanText(row.Title) || '-',
      email: cleanText(row.DIVHEAD_PIC?.Email) || cleanText(row.EMAIL),
      claims: cleanText(row['DIVHEAD_PIC#Claims']),
      jobTitle: cleanText(row.DIVHEAD_PIC?.JobTitle) || cleanText(row.CAT) || cleanText(row.Title),
      person: row.DIVHEAD_PIC,
    })),
  )
}

async function getApprovalRoutingRows(tccdNo: string) {
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

    return Array.isArray(result.data) ? result.data : []
  } catch {
    const result = await withPowerAppsTimeout(
      ApprovalFlowTCCDService.getAll({
        select: approvalFlowColumns,
        top: 500,
        orderBy: ['Seq_approval asc'],
      }),
    )

    return (Array.isArray(result.data) ? result.data : []).filter(
      (row) => cleanText(row.Title) === normalizedTccdNo,
    )
  }
}

function mapAdminRow(request: TCCDRead): AdminRow {
  const createdDate = request.Created ? new Date(request.Created) : null

  return {
    id: String(request.ID ?? request.TCCD_NO ?? crypto.randomUUID()),
    tccdNo: cleanText(request.TCCD_NO),
    title: cleanText(request.COURSE_TITLE) || cleanText(request.Title) || '-',
    picName: cleanText(request.PIC?.DisplayName),
    picEmail: cleanText(request.PIC?.Email),
    requestorName: cleanText(request.Author?.DisplayName),
    requestorEmail: cleanText(request.Author?.Email),
    requestDate: formatDate(createdDate),
    status: cleanText(request.REQUEST_STATUS) || 'Waiting Assign',
    rawDate: createdDate?.getTime() ?? 0,
    request,
  }
}

function getApprovalRunKey(row: AdminRow) {
  return row.tccdNo || row.id
}

function buildStatusSummary(rows: AdminRow[]) {
  return adminStatusConfigs.reduce<Record<string, number>>((summary, status) => {
    summary[status.label] = rows.filter((row) => normalizeStatus(row.status) === normalizeStatus(status.label)).length
    return summary
  }, {})
}

function filterAdminRows(rows: AdminRow[], search: string, activeStatus: string | null) {
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
      row.requestorEmail,
      row.status,
      row.request.NOTE,
      row.request.TYPE_OF_REQUEST,
      row.request.TYPE_OF_LEARNING,
      row.request.VENDOR_NAME,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  })
}

function validateStatusTransition(currentStatus: string, nextStatus?: string) {
  if (!nextStatus) {
    return
  }

  if (isLockedStatus(currentStatus)) {
    throw new Error('Status sudah final, update tidak diperbolehkan.')
  }

  if (!canMoveToStatus(currentStatus, nextStatus)) {
    throw new Error(`Status tidak boleh mundur dari ${currentStatus} ke ${nextStatus}.`)
  }
}

function canMoveToStatus(currentStatus: string, nextStatus: string) {
  const currentRank = getStatusRank(currentStatus)
  const nextRank = getStatusRank(nextStatus)

  if (isTerminalStatus(nextStatus)) {
    return true
  }

  if (currentRank === null || nextRank === null) {
    return true
  }

  return nextRank >= currentRank
}

function getStatusRank(status: string) {
  const normalizedStatus = normalizeStatus(status)
  const ranks: Record<string, number> = {
    submitted: 0,
    'waiting assign': 1,
    assigned: 2,
    'waiting approval': 3,
    'fully approved': 4,
  }

  return ranks[normalizedStatus] ?? null
}

function isTerminalStatus(status: string) {
  const normalizedStatus = normalizeStatus(status)
  return normalizedStatus === 'closed' || normalizedStatus === 'rejected' || normalizedStatus === 'cancelled'
}

function isLockedStatus(status: string) {
  return isTerminalStatus(status)
}

function canEditApprovalRouting(status: string) {
  const rank = getStatusRank(status)
  return !isLockedStatus(status) && (rank === null || rank < 3)
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return undefined
  }

  const parsedValue = Number(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

function formatNumberInput(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
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

function createDetailValues(request: TCCDRead): AdminDetailValues {
  return {
    courseTitle: cleanText(request.COURSE_TITLE) || cleanText(request.Title),
    planningDate: toDateInputValue(request.PLANNING_DATE),
    requestType: cleanText(request.TYPE_OF_REQUEST) || 'training',
    justification: cleanText(request.JUSTIFICATION),
    objective: cleanText(request.OBJECTIVE),
    participantCount: formatNumberInput(request.NUMBER_PARTICIPANT),
    learningImplement: cleanText(request.PROVIDER) || 'internal',
    note: cleanText(request.NOTE),
    budget: cleanText(request.BUDGET),
    expenseCategory: cleanText(request.EXPENSE_CATEGORY),
    vendorName: cleanText(request.VENDOR_NAME),
    typeOfLearning: cleanText(request.TYPE_OF_LEARNING),
    totalExpense: formatNumberInput(request.TOTAL_EXPENSES),
  }
}

function mapPicToTccdPic(person: PIC_TCCDValue): PICValue {
  return {
    '@odata.type': person['@odata.type'],
    Claims: person.Claims,
    DisplayName: person.DisplayName,
    Email: person.Email,
    Picture: person.Picture,
    Department: person.Department,
    JobTitle: person.JobTitle,
  }
}

function buildApprovalRoutingPayload(
  tccdNo: string,
  approver: RoutingApprover,
  sequence: number,
  options: { includeStatus?: boolean; useFullPersonObject?: boolean } = {},
): Omit<ApprovalFlowTCCDWrite, 'ID'> {
  const includeStatus = options.includeStatus ?? true
  const person = options.useFullPersonObject
    ? mapDivHeadPersonToApproverPerson(approver)
    : buildWritableApproverPerson(approver)
  const payload: Omit<ApprovalFlowTCCDWrite, 'ID'> = {
    Title: tccdNo,
    Department_App: approver.jobTitle,
    Seq_approval: sequence,
    Approver_name: person,
  }

  if (includeStatus) {
    payload.Status_Flow = 'Waiting Approval'
  }

  return payload
}

function buildWritableApproverPerson(approver: RoutingApprover): Approver_nameValue {
  return {
    '@odata.type': approver.person?.['@odata.type'] || '#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser',
    Claims: approver.claims,
  } as Approver_nameValue
}

function mapDivHeadPersonToApproverPerson(approver: RoutingApprover): Approver_nameValue {
  return {
    '@odata.type': approver.person?.['@odata.type'] || '#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser',
    Claims: approver.claims,
    DisplayName: approver.person?.DisplayName || approver.name,
    Email: approver.person?.Email || approver.email,
    Picture: approver.person?.Picture || '',
    Department: approver.person?.Department || '',
    JobTitle: approver.person?.JobTitle || approver.jobTitle,
  }
}

function mapApprovalRowsToApprovers(
  rows: ApprovalFlowTCCDRead[],
  preferredApprovers: RoutingApprover[] = [],
) {
  const sortedRows = [...rows].sort((first, second) => {
    const firstSeq = typeof first.Seq_approval === 'number' ? first.Seq_approval : 0
    const secondSeq = typeof second.Seq_approval === 'number' ? second.Seq_approval : 0
    return firstSeq - secondSeq
  })

  return dedupeApprovers(
    sortedRows
      .map((row) => {
        const claims = cleanText(row['Approver_name#Claims']) || cleanText(row.Approver_name?.Claims)
        const preferred = preferredApprovers.find(
          (approver) => normalizeClaims(approver.claims) === normalizeClaims(claims),
        )

        if (preferred) {
          return preferred
        }

        if (!claims && !row.Approver_name) {
          return null
        }

        return {
          id: claims || String(row.ID ?? crypto.randomUUID()),
          name: cleanText(row.Approver_name?.DisplayName) || '-',
          email: cleanText(row.Approver_name?.Email),
          claims,
          jobTitle: cleanText(row.Department_App) || cleanText(row.Approver_name?.JobTitle),
          person: row.Approver_name
            ? {
                '@odata.type': row.Approver_name['@odata.type'],
                Claims: row.Approver_name.Claims,
                DisplayName: row.Approver_name.DisplayName,
                Email: row.Approver_name.Email,
                Picture: row.Approver_name.Picture,
                Department: row.Approver_name.Department,
                JobTitle: row.Approver_name.JobTitle,
              }
            : undefined,
        } satisfies RoutingApprover
      })
      .filter((approver): approver is RoutingApprover => Boolean(approver)),
  )
}

function mergeApprovers(...groups: RoutingApprover[][]) {
  return dedupeApprovers(groups.flat())
}

function dedupeApprovers(approvers: RoutingApprover[]) {
  const seen = new Set<string>()
  const uniqueApprovers: RoutingApprover[] = []

  for (const approver of approvers) {
    const key = normalizeClaims(approver.claims) || approver.email.toLowerCase() || approver.id

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueApprovers.push(approver)
  }

  return uniqueApprovers
}

function normalizeClaims(claims: string) {
  return claims.trim().toLowerCase()
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'NA'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, 'A')
}

function cleanText(value?: string | null) {
  return value?.trim() ?? ''
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

function escapeODataValue(value: string) {
  return value.replace(/'/g, "''")
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

function emptyParticipantRow(): ParticipantEditRow {
  return {
    sn: '',
    name: '',
    division: '',
    siteArea: '',
    employeeStatus: '',
    email: '',
    serviceYear: '',
  }
}

function applyParticipantLookup(
  row: ParticipantEditRow,
  personnelNumber: string,
  employeeLookup: EmployeeLookupData | null,
): ParticipantEditRow {
  const matchedEmployee = findEmployeeByPersonnelNumber(employeeLookup, personnelNumber)

  if (matchedEmployee) {
    console.info('Employee lookup matched admin participant', {
      personnelNumber,
      nama: matchedEmployee.nama,
      division: matchedEmployee.division,
      area: matchedEmployee.area,
      status: matchedEmployee.status,
      masaKerja: matchedEmployee.masaKerja,
      jobTitle: matchedEmployee.jobTitle,
    })
  } else if (personnelNumber.trim()) {
    console.info('Employee lookup not found for admin participant. Clearing lookup fields.', {
      personnelNumber,
      lookupLoaded: Boolean(employeeLookup),
    })
  }

  return {
    ...row,
    sn: personnelNumber,
    name: matchedEmployee?.nama ?? '',
    division: matchedEmployee?.division ?? '',
    siteArea: matchedEmployee?.area ?? '',
    employeeStatus: matchedEmployee?.status ?? '',
    serviceYear: matchedEmployee?.masaKerja ?? '',
  }
}

function buildParticipantWritePayload(row: ParticipantEditRow): Partial<Omit<import('./generated/models/TCCDPARTICIPANTSModel').TCCDPARTICIPANTSWrite, 'ID'>> {
  return {
    SN: row.sn.trim(),
    NAME: row.name.trim(),
    DIVISION: row.division.trim(),
    SITE_AREA: row.siteArea.trim(),
    EMPLOYEE_STATUS: row.employeeStatus.trim(),
    EMAIL: row.email.trim(),
    SERVICE_YEAR: row.serviceYear.trim(),
  }
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
