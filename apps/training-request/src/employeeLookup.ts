import rawEmployees from './excel/employee.json'

export type EmployeeRecord = {
  personnelNumber: string
  nama: string
  division: string
  area: string
  status: string
  masaKerja: string
  jobTitle: string
}

type EmployeeJsonRecord = {
  personnel_number?: string
  nama?: string
  division?: string
  area?: string
  status?: string
  masa_kerja?: string
  jobtitle?: string
}

export type EmployeeLookupData = {
  employeesByPersonnelNumber: Map<string, EmployeeRecord>
  divisionOptions: string[]
  areaOptions: string[]
  statusOptions: string[]
}

let cachedLookup: EmployeeLookupData | null = null

export async function loadEmployeeLookup(_signal?: AbortSignal): Promise<EmployeeLookupData> {
  if (cachedLookup) {
    return cachedLookup
  }

  const data = rawEmployees as unknown

  if (!Array.isArray(data)) {
    throw new Error('Employee JSON harus berupa array.')
  }

  const employees = (data as EmployeeJsonRecord[])
    .map(mapEmployeeJsonRecord)
    .filter((employee) => employee.personnelNumber)

  if (employees.length === 0) {
    throw new Error('Employee JSON tidak memiliki data personnel_number yang valid.')
  }

  const employeesByPersonnelNumber = new Map<string, EmployeeRecord>()

  for (const employee of employees) {
    employeesByPersonnelNumber.set(normalizeLookupKey(employee.personnelNumber), employee)
  }

  cachedLookup = {
    employeesByPersonnelNumber,
    divisionOptions: uniqueSorted(employees.map((employee) => employee.division)),
    areaOptions: uniqueSorted(employees.map((employee) => employee.area)),
    statusOptions: uniqueSorted(employees.map((employee) => employee.status)),
  }

  console.info('Employee lookup loaded (inline)', {
    totalEmployees: employeesByPersonnelNumber.size,
  })

  return cachedLookup
}

export function findEmployeeByPersonnelNumber(
  lookupData: EmployeeLookupData | null,
  personnelNumber: string,
) {
  const lookupKey = normalizeLookupKey(personnelNumber)

  if (!lookupData || !lookupKey) {
    return null
  }

  return lookupData.employeesByPersonnelNumber.get(lookupKey) ?? null
}

function mapEmployeeJsonRecord(record: EmployeeJsonRecord): EmployeeRecord {
  return {
    personnelNumber: cleanText(record.personnel_number),
    nama: cleanText(record.nama),
    division: cleanText(record.division),
    area: cleanText(record.area),
    status: cleanText(record.status),
    masaKerja: cleanText(record.masa_kerja),
    jobTitle: cleanText(record.jobtitle),
  }
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase()
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}
