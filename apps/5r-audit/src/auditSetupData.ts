import { getContext } from '@microsoft/power-apps/app'
import type { IOperationResult } from '@microsoft/power-apps/data'
import type { AuditorValue } from './generated/models/_5RNewAppsModel'
import {
  getItemsOperationName,
  powerAppsClient,
  primaryDataSourceName,
  sharePointSiteUrl,
} from './powerAppsClient'
import { getPowerAppsOperationErrorDetail } from './powerAppsData'
import { plainText } from './textUtil'

const areaAuditListId = '00000000-0000-4000-8000-000000000404'
const areaAuditListName = 'Area Audit 5R'
const maxRows = 2000

export type AreaAuditRow = Record<string, unknown>

export type CurrentAuditor = {
  displayName: string
  email: string
  claims: string
  /**
   * Objek SPListExpandedUser — nilai yang menurut dokumentasi connector
   * SharePoint ("Resolve person") di-assign ke kolom bertipe person saat
   * create/update item. SELALU terisi: dari people picker bila exact match,
   * atau dibangun dari claims user login. JANGAN kirim key "<Field>#Claims"
   * di payload PostItem — SharePoint menolak dengan 400
   * `The passed-in field "Auditor#Claims" could not be found`.
   */
  person: AuditorValue
}

export type AreaAuditData = {
  rows: AreaAuditRow[]
  plantFieldKey: string
  areaFieldKey: string
}

type GetItemsResponse = {
  value?: AreaAuditRow[]
}

function isNotFoundOperationResult(result: IOperationResult<unknown>) {
  const error = result.error

  if (!error) {
    return false
  }

  if (typeof error === 'object') {
    const record = error as unknown as Record<string, unknown>

    if (record.status === 404 || record.status === '404') {
      return true
    }

    if (typeof record.message === 'string' && record.message.includes('"statusCode":404')) {
      return true
    }
  }

  return error instanceof Error && error.message.includes('"statusCode":404')
}

async function fetchAreaAuditRows(table: string): Promise<IOperationResult<GetItemsResponse>> {
  return powerAppsClient.executeAsync<
    {
      dataset: string
      table: string
      '$top': number
    },
    GetItemsResponse
  >({
    connectorOperation: {
      tableName: primaryDataSourceName,
      operationName: getItemsOperationName,
      parameters: {
        dataset: sharePointSiteUrl,
        table,
        '$top': maxRows,
      },
    },
  })
}

function extractRows(data: GetItemsResponse | AreaAuditRow[] | undefined): AreaAuditRow[] {
  if (Array.isArray(data)) {
    return data
  }

  return data?.value ?? []
}

/**
 * Nama internal kolom SharePoint bisa memakai encoding seperti `_x0020_` (spasi).
 * Normalisasi membuang encoding + non-alfanumerik supaya "Lokasi Plant" bisa
 * ketemu baik sebagai `LokasiPlant` maupun `Lokasi_x0020_Plant`.
 */
function normalizeFieldKey(key: string) {
  return key
    .replace(/_x[0-9a-fA-F]{4}_/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function resolveFieldKey(rows: AreaAuditRow[], normalizedTarget: string): string | null {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith('{') || key.startsWith('@') || key.includes('#')) {
        continue
      }

      if (normalizeFieldKey(key) === normalizedTarget) {
        return key
      }
    }
  }

  return null
}

/** Kolom choice SharePoint bisa datang sebagai object `{ Value: '...' }`;
 *  kolom Note datang sebagai HTML → dibersihkan dengan plainText. */
export function toFieldDisplayString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return plainText(value) || null
  }

  if (value && typeof value === 'object') {
    const nested = (value as { Value?: unknown }).Value

    if (typeof nested === 'string' && nested.trim()) {
      return plainText(nested) || null
    }
  }

  return null
}

export function getDistinctFieldValues(rows: AreaAuditRow[], fieldKey: string): string[] {
  const values = new Set<string>()

  for (const row of rows) {
    const value = toFieldDisplayString(row[fieldKey])

    if (value) {
      values.add(value)
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, 'id-ID'))
}

// Cache 1x per sesi — list Area Audit 5R besar (sampai 2000 baris) dan dipakai
// setup + filter follow-up. Hindari re-fetch tiap mount halaman.
let areaAuditCache: Promise<AreaAuditData> | null = null

export function getAreaAuditData(): Promise<AreaAuditData> {
  if (!areaAuditCache) {
    areaAuditCache = fetchAreaAuditData().catch((err) => {
      areaAuditCache = null // biar bisa retry kalau gagal
      throw err
    })
  }
  return areaAuditCache
}

async function fetchAreaAuditData(): Promise<AreaAuditData> {
  let result = await fetchAreaAuditRows(areaAuditListId)

  if (!result.success && isNotFoundOperationResult(result)) {
    result = await fetchAreaAuditRows(areaAuditListName)
  }

  if (!result.success) {
    throw new Error(
      `Gagal memuat list "${areaAuditListName}": ${getPowerAppsOperationErrorDetail(result.error)}`,
    )
  }

  const rows = extractRows(result.data)

  if (rows.length === 0) {
    throw new Error(`List "${areaAuditListName}" kosong — tidak ada pilihan Plant/Site dan Area 5R.`)
  }

  const plantFieldKey = resolveFieldKey(rows, 'lokasiplant')
  const areaFieldKey = resolveFieldKey(rows, 'area5r')

  if (!plantFieldKey || !areaFieldKey) {
    const missing = !plantFieldKey ? '"Lokasi Plant"' : '"Area 5R"'
    const availableKeys = Object.keys(rows[0])
      .filter((key) => !key.startsWith('{') && !key.startsWith('@') && !key.includes('#'))
      .join(', ')

    console.info(`Area Audit 5R — kolom tersedia: ${availableKeys}`)
    throw new Error(
      `Kolom ${missing} tidak ditemukan di list "${areaAuditListName}". Kolom tersedia: ${availableKeys}`,
    )
  }

  return { rows, plantFieldKey, areaFieldKey }
}

type PersonEntityValue = {
  '@odata.type'?: string
  Claims?: string
  DisplayName?: string
  Email?: string
  Picture?: string
  Department?: string
  JobTitle?: string
}

function parsePersonArray(data: unknown): PersonEntityValue[] {
  if (Array.isArray(data)) {
    return data as PersonEntityValue[]
  }

  if (data && typeof data === 'object') {
    const nested = (data as { value?: unknown }).value

    if (Array.isArray(nested)) {
      return nested as PersonEntityValue[]
    }
  }

  return []
}

/**
 * Endpoint entity kolom person Auditor (sumber people picker) — operasi
 * `GetAuditor` sudah ada di generated schema; mengembalikan bentuk
 * SPListExpandedUser yang sama dengan action "Resolve person" di dokumentasi
 * connector. Dipanggil lewat powerAppsClient (BUKAN generated service) supaya
 * registry schema SDK terinisialisasi dengan schema gabungan — lihat catatan
 * singleton di powerAppsClient.ts.
 */
async function fetchAuditorEntity(search: string): Promise<IOperationResult<unknown>> {
  return powerAppsClient.executeAsync<{ search: string }, unknown>({
    connectorOperation: {
      tableName: primaryDataSourceName,
      operationName: 'GetAuditor',
      parameters: { search },
    },
  })
}

function toPersonValue(person: PersonEntityValue): AuditorValue {
  return {
    '@odata.type':
      person['@odata.type'] ?? '#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser',
    Claims: person.Claims ?? '',
    DisplayName: person.DisplayName ?? '',
    Email: person.Email ?? '',
    Picture: person.Picture ?? '',
    Department: person.Department ?? '',
    JobTitle: person.JobTitle ?? '',
  }
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Timeout membaca context Power Apps.')), ms)
  })
}

/**
 * Auditor = user yang sedang login. Pola mengikuti TCCD (adminAccess.ts):
 * context host (getContext → userPrincipalName) adalah SATU-SATUNYA sumber
 * identitas; claims dibangun langsung `i:0#.f|membership|<email>`. Endpoint
 * people picker hanya dipakai untuk memperkaya data (foto/jabatan) dan HANYA
 * bila hasilnya persis sama dengan email login — tidak pernah mengambil
 * kandidat lain, supaya auditor tidak pernah berubah jadi orang lain.
 */
export async function getCurrentAuditor(): Promise<CurrentAuditor> {
  let contextUser: { fullName?: string; userPrincipalName?: string } | undefined

  try {
    // Race 2.5 detik: player tertentu bisa hang di getContext (pola TCCD).
    const context = await Promise.race([getContext(), timeoutAfter(2500)])
    contextUser = context?.user
  } catch {
    // context tidak tersedia — ditangani lewat cek email di bawah
  }

  const email = contextUser?.userPrincipalName?.trim().toLowerCase() ?? ''

  if (!email) {
    throw new Error(
      'User login Power Apps tidak ditemukan. Buka aplikasi lewat "npx power-apps run" atau dari Power Apps, bukan vite dev murni.',
    )
  }

  const displayName = contextUser?.fullName?.trim() || email.split('@')[0].replace(/[._-]+/g, ' ')
  const claims = `i:0#.f|membership|${email}`

  // Coba perkaya dari people picker — exact match saja. Kalau gagal, objek
  // person tetap dibangun dari claims user login (Claims adalah bagian yang
  // dipakai SharePoint untuk resolve; field lain hanya metadata tampilan).
  let person: AuditorValue | null = null

  try {
    const entityResult = await fetchAuditorEntity(email)

    if (entityResult.success) {
      const exact = parsePersonArray(entityResult.data).find((candidate) => {
        const candidateEmail = candidate.Email?.trim().toLowerCase() ?? ''
        const candidateClaims = candidate.Claims?.trim().toLowerCase() ?? ''
        return candidateEmail === email || candidateClaims === claims
      })

      if (exact?.Claims) {
        person = toPersonValue(exact)
      }
    }
  } catch {
    // resolve gagal → pakai objek person dari claims login
  }

  if (!person) {
    person = toPersonValue({ Claims: claims, DisplayName: displayName, Email: email })
  }

  return {
    displayName: person.DisplayName.trim() || displayName,
    email: person.Email.trim().toLowerCase() || email,
    claims: person.Claims || claims,
    person,
  }
}
