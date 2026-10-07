import { ALL_AUDIT_ITEMS } from './auditFormConfig'
import {
  buildThumbnailFieldValue,
  followUpListId,
  getListItemColumns,
  parseThumbnailUrl,
  sharePointGet,
  uploadEvidenceFileViaFlow,
  validateUpdateListItem,
  type FormValue,
} from './evidenceImageColumn'
import { compressImage, extensionForType } from './imagePrep'
import { plainText } from './textUtil'

// 'New' = audit baru yang belum ditindaklanjuti (di-set otomatis saat create).
// Casing HARUS sama persis dengan nilai choice di kolom SharePoint StatusActionPlan.
export const FOLLOWUP_STATUS_OPTIONS = ['New', 'On Progress', 'Closed'] as const

const serverBatchSize = 50
const targetMatches = 20
const maxBatchesPerCall = 12
const START_CURSOR = 2147483647 // ID lt sentinel (mulai dari terbaru)

// $select KETAT: hanya field kartu; person cukup nama (Auditor/Title). Ini
// membuat payload jauh lebih kecil daripada retrieveMultiple generik yang
// menarik banyak kolom + expand semua person.
const cardSelect = [
  'ID',
  'Title',
  'StatusActionPlan',
  'Area5R',
  'Plant_x002f_Site',
  'TanggalPelaksanaan',
  'TotalScore',
  'Auditor/Title',
  'PICArea/Title',
].join(',')
const cardExpand = 'Auditor,PICArea'

export type FollowUpFilters = {
  plantSite: string
  area5R: string
  status: string
  dateFrom: string
  dateTo: string
  search: string
}

export const emptyFilters: FollowUpFilters = {
  plantSite: '',
  area5R: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  search: '',
}

export type FollowUpRecord = {
  id: number
  title: string
  auditor: string
  picArea: string
  status: string
  area5R: string
  plantSite: string
  tanggal: string
  totalScore: number
}

export type FollowUpPage = {
  records: FollowUpRecord[]
  lastId: number
  hasMore: boolean
  notice: string
}

type RestPerson = { Title?: string } | null
type RestRow = {
  ID?: number
  Title?: string
  StatusActionPlan?: string
  Area5R?: string
  Plant_x002f_Site?: string
  TanggalPelaksanaan?: string
  TotalScore?: number
  Auditor?: RestPerson
  PICArea?: RestPerson
}

function escapeODataValue(value: string) {
  return value.replace(/'/g, "''")
}

function toRecord(row: RestRow): FollowUpRecord {
  return {
    id: typeof row.ID === 'number' ? row.ID : 0,
    title: plainText(row.Title),
    auditor: plainText(row.Auditor?.Title),
    picArea: plainText(row.PICArea?.Title),
    status: plainText(row.StatusActionPlan),
    area5R: plainText(row.Area5R),
    plantSite: plainText(row.Plant_x002f_Site),
    tanggal: row.TanggalPelaksanaan ?? '',
    totalScore: typeof row.TotalScore === 'number' ? row.TotalScore : 0,
  }
}

function withinDateRange(tanggal: string, filters: FollowUpFilters) {
  if (!filters.dateFrom && !filters.dateTo) {
    return true
  }
  const date = tanggal.slice(0, 10)
  if (filters.dateFrom && date < filters.dateFrom) {
    return false
  }
  if (filters.dateTo && date > filters.dateTo) {
    return false
  }
  return true
}

/** Filter kolom Note (client-side — kolom Note tak bisa di-$filter server). */
function matchesClientFilters(rec: FollowUpRecord, filters: FollowUpFilters) {
  if (filters.plantSite && rec.plantSite !== filters.plantSite) return false
  if (filters.area5R && rec.area5R !== filters.area5R) return false
  // Case-insensitive: data lama bisa tersimpan 'NEW'/'New'/'new' — jangan sampai
  // filter membuang baris hanya karena beda kapital.
  if (filters.status && rec.status.toLowerCase() !== filters.status.toLowerCase()) return false
  if (!withinDateRange(rec.tanggal, filters)) return false
  return true
}

async function fetchBatch(search: string, cursor: number): Promise<RestRow[]> {
  const filterParts = [`ID lt ${cursor}`]
  if (search.trim()) {
    filterParts.push(`substringof('${escapeODataValue(search.trim())}',Title)`)
  }
  const uri =
    `_api/web/lists(guid'${followUpListId}')/items` +
    `?$select=${encodeURIComponent(cardSelect)}` +
    `&$expand=${encodeURIComponent(cardExpand)}` +
    `&$filter=${encodeURIComponent(filterParts.join(' and '))}` +
    `&$orderby=ID desc&$top=${serverBatchSize}`

  const data = await sharePointGet<{ value?: RestRow[] }>(uri)
  return data?.value ?? []
}

/**
 * Satu "halaman": loop fetch batch (keyset `ID lt`, terbaru dulu) + saring
 * kolom Note client-side, sampai ~targetMatches / data habis / cap batch.
 */
export async function getFollowUpRecords(filters: FollowUpFilters, lastId: number): Promise<FollowUpPage> {
  const matches: FollowUpRecord[] = []
  let cursor = lastId > 0 ? lastId : START_CURSOR
  let serverHasMore = true
  let batches = 0

  while (matches.length < targetMatches && serverHasMore && batches < maxBatchesPerCall) {
    const rows = await fetchBatch(filters.search, cursor)
    batches += 1

    if (rows.length > 0) {
      const lastRowId = rows[rows.length - 1].ID
      if (typeof lastRowId === 'number') {
        cursor = lastRowId
      }
    }
    serverHasMore = rows.length === serverBatchSize

    for (const row of rows) {
      const rec = toRecord(row)
      if (matchesClientFilters(rec, filters)) {
        matches.push(rec)
      }
    }
  }

  return { records: matches, lastId: cursor, hasMore: serverHasMore, notice: '' }
}

// ── Detail ──

export type FollowUpItemState = {
  id: string
  label: string
  categoryKey: string
  color: string
  score: string
  keterangan: string
  beforeImageUrl: string | null
  actionText: string
  afterImageUrl: string | null
  newAfterPhoto: File | null
}

export type FollowUpDetail = {
  status: string
  items: FollowUpItemState[]
}

const detailSelectFields = [
  'StatusActionPlan',
  ...ALL_AUDIT_ITEMS.flatMap((item) => [
    item.scoreField,
    item.keteranganField,
    item.actionPlanField,
    item.imageFieldInternalName,
    item.actionImageFieldInternalName,
  ]),
]

export async function getFollowUpDetail(recordId: number): Promise<FollowUpDetail> {
  const raw = await getListItemColumns(recordId, detailSelectFields)

  const items: FollowUpItemState[] = ALL_AUDIT_ITEMS.map((item) => {
    const scoreRaw = raw[item.scoreField]
    return {
      id: item.id,
      label: item.label,
      categoryKey: item.id.slice(0, 2).toUpperCase(),
      color: '#0077b6',
      score: scoreRaw === null || scoreRaw === undefined ? '' : String(scoreRaw),
      keterangan: plainText(raw[item.keteranganField]),
      beforeImageUrl: parseThumbnailUrl(raw[item.imageFieldInternalName]),
      actionText: plainText(raw[item.actionPlanField]),
      afterImageUrl: parseThumbnailUrl(raw[item.actionImageFieldInternalName]),
      newAfterPhoto: null,
    }
  })

  return {
    status: typeof raw.StatusActionPlan === 'string' ? raw.StatusActionPlan : '',
    items,
  }
}

// ── Writeback ──

export type SaveFollowUpResult = {
  imageCount: number
  warnings: string[]
}

export async function saveFollowUp(
  recordId: number,
  status: string,
  items: FollowUpItemState[],
): Promise<SaveFollowUpResult> {
  const formValues: FormValue[] = []
  const warnings: string[] = []
  let imageCount = 0

  if (status) {
    formValues.push({ FieldName: 'StatusActionPlan', FieldValue: status })
  }

  const config = new Map(ALL_AUDIT_ITEMS.map((item) => [item.id, item]))

  for (const state of items) {
    const item = config.get(state.id)
    if (!item) {
      continue
    }

    // Action plan teks (tulis apa adanya; kosong pun boleh menimpa).
    formValues.push({ FieldName: item.actionPlanField, FieldValue: state.actionText.trim() })

    // Foto After baru → upload byte via flow, lalu kolom image.
    if (state.newAfterPhoto) {
      try {
        let content: Blob = state.newAfterPhoto
        try {
          content = await compressImage(state.newAfterPhoto)
        } catch {
          // pakai file asli kalau kompresi gagal
        }
        const fileName = `${item.evidencePrefix}_action_${crypto.randomUUID()}.${extensionForType(content.type)}`
        const uploaded = await uploadEvidenceFileViaFlow(fileName, content)
        formValues.push({
          FieldName: item.actionImageFieldInternalName,
          FieldValue: buildThumbnailFieldValue(item.actionImageFieldDisplayName, uploaded),
        })
        imageCount += 1
      } catch (err) {
        warnings.push(`${state.label}: foto after gagal (${err instanceof Error ? err.message : String(err)})`)
      }
    }
  }

  await validateUpdateListItem(recordId, formValues)

  return { imageCount, warnings }
}
