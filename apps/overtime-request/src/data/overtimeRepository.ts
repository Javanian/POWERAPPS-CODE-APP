import { getContext } from '@microsoft/power-apps/app'
import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { OvertimeEmployee, OvertimeRequest, OvertimeStatus, Shift } from '../domain/overtime'

// Thin data layer over two SharePoint lists. Field names match the list columns;
// mapping to domain types happens here so the UI never sees SharePoint shapes.

const requestList = 'overtime request'
const employeeList = 'overtime employee'

type RequestRecord = {
  ID?: number
  WorkDate?: string
  Shift?: string
  StartTime?: string
  EndTime?: string
  Department?: string
  Reason?: string
  EmployeesJson?: string
  Status?: string
  RequestedBy?: string
  Created?: string
  DecidedBy?: string
  DecidedAt?: string
  DecisionNote?: string
}

type EmployeeRecord = {
  ID?: number
  Title?: string
  FullName?: string
  Department?: string
}

export type CurrentUser = { name: string; email: string }

const client = getClient(dataSourcesInfo)

function unwrap<T>(result: { success: boolean; data: T; error?: unknown }, context: string): T {
  if (!result.success) {
    const detail = result.error instanceof Error ? result.error.message : String(result.error ?? '')
    throw new Error(`${context}${detail ? `: ${detail}` : ''}`)
  }
  return result.data
}

function parseEmployees(json?: string): OvertimeEmployee[] {
  try {
    const value = JSON.parse(json ?? '[]') as unknown
    return Array.isArray(value) ? (value as OvertimeEmployee[]) : []
  } catch {
    return []
  }
}

/** Display number derived from the list item ID, so it is unique without a counter list. */
export function requestNumber(id: number, workDate: string) {
  return `SPL-${workDate.slice(0, 4)}-${String(id).padStart(4, '0')}`
}

function toRequest(record: RequestRecord): OvertimeRequest {
  const id = record.ID ?? 0
  const workDate = (record.WorkDate ?? '').slice(0, 10)
  const status = (['Pending', 'Approved', 'Rejected'] as const).find((value) => value === record.Status) ?? 'Pending'

  return {
    id,
    number: requestNumber(id, workDate),
    workDate,
    shift: (['1', '2', '3'] as const).find((value) => value === record.Shift) ?? '1',
    startTime: record.StartTime ?? '',
    endTime: record.EndTime ?? '',
    department: record.Department ?? '',
    reason: record.Reason ?? '',
    employees: parseEmployees(record.EmployeesJson),
    status,
    requestedBy: record.RequestedBy ?? '',
    requestedAt: record.Created ?? '',
    decidedBy: record.DecidedBy ?? '',
    decidedAt: record.DecidedAt ?? '',
    decisionNote: record.DecisionNote ?? '',
  }
}

export async function listRequests(): Promise<OvertimeRequest[]> {
  const result = await client.retrieveMultipleRecordsAsync<RequestRecord>(requestList, {
    orderBy: ['WorkDate desc', 'ID desc'],
    top: 500,
  })
  return unwrap(result, 'Daftar SPL belum bisa dimuat').map(toRequest)
}

export async function listEmployees(): Promise<OvertimeEmployee[]> {
  const result = await client.retrieveMultipleRecordsAsync<EmployeeRecord>(employeeList, {
    orderBy: ['FullName asc'],
    top: 2000,
  })
  return unwrap(result, 'Data karyawan belum bisa dimuat').map((record) => ({
    nik: record.Title ?? String(record.ID ?? ''),
    name: record.FullName ?? record.Title ?? '-',
    department: record.Department ?? '',
  }))
}

export type NewRequest = {
  workDate: string
  shift: Shift
  startTime: string
  endTime: string
  department: string
  reason: string
  employees: OvertimeEmployee[]
}

export async function createRequest(draft: NewRequest, user: CurrentUser): Promise<OvertimeRequest> {
  const result = await client.createRecordAsync<RequestRecord, RequestRecord>(requestList, {
    WorkDate: draft.workDate,
    Shift: draft.shift,
    StartTime: draft.startTime,
    EndTime: draft.endTime,
    Department: draft.department,
    Reason: draft.reason.trim(),
    EmployeesJson: JSON.stringify(draft.employees),
    Status: 'Pending',
    RequestedBy: user.name,
  })
  return toRequest(unwrap(result, 'SPL belum bisa disimpan'))
}

export async function decideRequest(
  request: OvertimeRequest,
  status: Exclude<OvertimeStatus, 'Pending'>,
  note: string,
  user: CurrentUser,
): Promise<OvertimeRequest> {
  const changes = {
    Status: status,
    DecidedBy: user.name,
    DecidedAt: new Date().toISOString(),
    DecisionNote: note.trim(),
  }
  const result = await client.updateRecordAsync<RequestRecord, RequestRecord>(requestList, String(request.id), changes)
  unwrap(result, 'Keputusan belum bisa disimpan')
  // The update response may only echo changed fields, so merge onto the known request.
  return { ...request, status, decidedBy: changes.DecidedBy, decidedAt: changes.DecidedAt, decisionNote: changes.DecisionNote }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const context = await getContext()
    const email = context?.user?.userPrincipalName ?? ''
    return { name: context?.user?.fullName || email.split('@')[0] || 'User', email }
  } catch {
    return { name: 'User', email: '' }
  }
}
