import { _5RaddimageService } from './generated'
import { blobToDataUri } from './imagePrep'
import {
  httpRequestOperationName,
  powerAppsClient,
  primaryDataSourceName,
  sharePointSiteUrl,
} from './powerAppsClient'
import { getPowerAppsOperationErrorDetail } from './powerAppsData'

const listId = '00000000-0000-4000-8000-000000000014'
const siteServerRelativePath = '/sites/operations/corporate/QHSE'
const serverUrl = 'https://example.sharepoint.com'

/** Folder kanonis file kolom Image — sama dengan yang dipakai form SharePoint. */
export const imageFolderServerRelative = `${siteServerRelativePath}/SiteAssets/Lists/${listId}`

type SharePointHttpRequest = {
  method: 'GET' | 'POST'
  uri: string
  headers?: Record<string, string>
  body?: string
}

const jsonHeaders = {
  accept: 'application/json;odata=nometadata',
  'content-type': 'application/json;odata=nometadata',
}

async function sharePointHttpRequest<TResult>(request: SharePointHttpRequest): Promise<TResult> {
  const result = await powerAppsClient.executeAsync<{ dataset: string; request: SharePointHttpRequest }, TResult>({
    connectorOperation: {
      tableName: primaryDataSourceName,
      operationName: httpRequestOperationName,
      parameters: {
        dataset: sharePointSiteUrl,
        request,
      },
    },
  })

  if (!result.success) {
    throw new Error(getPowerAppsOperationErrorDetail(result.error))
  }

  return result.data as TResult
}

/** Baca daftar attachment sebuah item (untuk verifikasi test upload). */
export async function getListItemAttachmentInfo(listGuid: string, itemId: number) {
  return sharePointHttpRequest<{ value?: Array<{ FileName?: string; ServerRelativeUrl?: string }> }>({
    method: 'GET',
    uri: `_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles`,
    headers: jsonHeaders,
  })
}

export type UploadedEvidenceFile = {
  fileName: string
  serverRelativeUrl: string
  uniqueId?: string
}

/**
 * Tulis byte file evidence lewat flow "5R add image" — upload binary langsung
 * dari code app TERBUKTI menyimpan base64 sebagai teks (file korup, ukuran
 * 4/3 dari asli), jadi decode jadi binary dilakukan flow.
 *
 * KONTRAK dengan flow (harus cocok, kalau tidak file korup):
 *  - App kirim DATA URI utuh ("data:image/jpeg;base64,...") di `text_1`.
 *  - Create file → File Content = `dataUriToBinary(triggerBody()?['text_1'])`
 *    (BUKAN base64ToBinary — itu untuk base64 telanjang).
 *  - Folder = SiteAssets/Lists/{listGuid}; Respond kembalikan `path`.
 * Nama parameter trigger V2: `text` = fileName, `text_1` = data URI.
 */
export async function uploadEvidenceFileViaFlow(fileName: string, file: Blob): Promise<UploadedEvidenceFile> {
  // Kirim data URI UTUH — flow memakai dataUriToBinary(), BUKAN base64ToBinary().
  const contentDataUri = await blobToDataUri(file)
  const result = await _5RaddimageService.Run({ text: fileName, text_1: contentDataUri })

  if (!result.success) {
    throw new Error(`Flow upload gagal: ${getPowerAppsOperationErrorDetail(result.error)}`)
  }

  const returnedPath = (result.data?.path ?? '').trim()
  console.info(`Flow upload OK (${fileName}) → path dari flow: ${returnedPath || '(KOSONG — cek action Respond di flow!)'}`)

  // Ikuti path yang DIKEMBALIKAN flow (folder ditentukan flow). Path dari
  // Create file biasanya site-relative (mis. /5R_image/foo.jpg) — beri prefix
  // site; kalau sudah server-relative penuh, pakai apa adanya.
  const candidates: string[] = []

  if (returnedPath) {
    if (returnedPath.startsWith(siteServerRelativePath)) {
      candidates.push(returnedPath)
    } else if (returnedPath.startsWith('/')) {
      candidates.push(`${siteServerRelativePath}${returnedPath}`, returnedPath)
    } else {
      candidates.push(`${siteServerRelativePath}/${returnedPath}`)
    }
  }

  candidates.push(`${imageFolderServerRelative}/${fileName}`)

  const uniqueCandidates = [...new Set(candidates)]
  console.info('Kandidat path verifikasi (urut):', JSON.stringify(uniqueCandidates))

  // Verifikasi integritas byte + ambil UniqueId — jangan percaya sukses flow
  // saja. Dua putaran dengan jeda: mengantisipasi lag replikasi SharePoint.
  let lastError: unknown = null

  for (let round = 0; round < 2; round += 1) {
    if (round > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500))
      console.info('Putaran verifikasi ke-2 (setelah jeda 2,5 detik)...')
    }

    for (const candidate of uniqueCandidates) {
      try {
        return await verifyUploadedEvidence(fileName, file.size, candidate)
      } catch (err) {
        lastError = err
        console.info(`Verifikasi di ${candidate} gagal:`, err instanceof Error ? err.message : err)
      }
    }
  }

  throw new Error(
    `file tidak ditemukan di semua kandidat path (${uniqueCandidates.join(' | ')}) — ` +
      `cek run history flow: output Create file menunjukkan lokasi tulis yang sebenarnya. ` +
      `Penyebab umum: Site Address flow bukan subsite penuh QHSE. Detail: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
  )
}

/**
 * Verifikasi hasil upload: file ada di path yang diharapkan, ukurannya utuh
 * (bukan base64-sebagai-teks), sekaligus ambil UniqueId — properti `id` WAJIB
 * ada di JSON kolom image agar tampil di Power Apps/mobile.
 */
export async function verifyUploadedEvidence(
  fileName: string,
  expectedSize: number,
  serverRelativeUrl: string,
): Promise<UploadedEvidenceFile> {
  const escapedPath = serverRelativeUrl.replace(/'/g, "''")

  const fileInfo = await sharePointHttpRequest<{ UniqueId?: string; Length?: string | number }>({
    method: 'GET',
    uri: `_api/web/GetFileByServerRelativePath(decodedUrl='${escapedPath}')?$select=UniqueId,Length`,
    headers: jsonHeaders,
  })

  const rawLength = fileInfo?.Length
  const length = typeof rawLength === 'string' ? Number.parseInt(rawLength, 10) : rawLength

  if (Number.isFinite(length) && Math.abs((length as number) - expectedSize) > 2) {
    throw new Error(`file tersimpan ${length} bytes ≠ asli ${expectedSize} bytes — kemungkinan korup`)
  }

  return { fileName, serverRelativeUrl, uniqueId: fileInfo?.UniqueId }
}

export type EvidenceColumnEntry = {
  internalName: string
  /** Display name kolom — dipakai di properti `fieldName` JSON thumbnail. */
  displayName: string
  uploaded: UploadedEvidenceFile
}

type ValidateUpdateResult = {
  value?: Array<{ FieldName?: string; HasException?: boolean; ErrorMessage?: string | null }>
}

/**
 * Tulis SEMUA kolom image dalam SATU panggilan ValidateUpdateListItem
 * (formValues menerima banyak field sekaligus — jangan panggil per kolom).
 */
/**
 * Bentuk JSON kolom Image = persis nilai yang TERBUKTI render (getmethod.md):
 * fieldName memakai DISPLAY name, tanpa nativeFile, tanpa fieldId.
 */
export function buildThumbnailFieldValue(displayName: string, uploaded: UploadedEvidenceFile): string {
  return JSON.stringify({
    type: 'thumbnail',
    fileName: uploaded.fileName,
    fieldName: displayName,
    serverUrl,
    serverRelativeUrl: uploaded.serverRelativeUrl,
    id: uploaded.uniqueId,
  })
}

export type FormValue = { FieldName: string; FieldValue: string }

/**
 * Generic ValidateUpdateListItem — menerima kolom apa saja (teks, choice,
 * image JSON) dalam satu panggilan. Dipakai create (image) & follow-up
 * (action plan + status + foto after).
 */
export async function validateUpdateListItem(itemId: number, formValues: FormValue[]): Promise<void> {
  if (formValues.length === 0) {
    return
  }

  console.info('ValidateUpdateListItem formValues:', JSON.stringify(formValues))

  const response = await sharePointHttpRequest<ValidateUpdateResult>({
    method: 'POST',
    uri: `_api/web/lists(guid'${listId}')/items(${itemId})/ValidateUpdateListItem()`,
    headers: jsonHeaders,
    body: JSON.stringify({ formValues, bNewDocumentUpdate: false }),
  })

  const failedFields = (response?.value ?? []).filter((entry) => entry.HasException)

  if (failedFields.length > 0) {
    throw new Error(
      failedFields.map((entry) => `${entry.FieldName}: ${entry.ErrorMessage || 'gagal'}`).join('; '),
    )
  }
}

export async function writeEvidenceImageColumns(itemId: number, entries: EvidenceColumnEntry[]): Promise<void> {
  await validateUpdateListItem(
    itemId,
    entries.map(({ internalName, displayName, uploaded }) => ({
      FieldName: internalName,
      FieldValue: buildThumbnailFieldValue(displayName, uploaded),
    })),
  )
}

/** GET REST generik lewat connector HttpRequest (auth ditangani runtime). */
export async function sharePointGet<T>(uri: string): Promise<T> {
  return sharePointHttpRequest<T>({ method: 'GET', uri, headers: jsonHeaders })
}

export const followUpListId = listId

/**
 * Baca kolom item lewat REST (termasuk kolom Image yang TIDAK muncul di schema
 * connector). Mengembalikan objek mentah field → value.
 */
export async function getListItemColumns(
  itemId: number,
  selectFields: string[],
): Promise<Record<string, unknown>> {
  const select = ['Id', ...selectFields].join(',')
  const data = await sharePointHttpRequest<Record<string, unknown>>({
    method: 'GET',
    uri: `_api/web/lists(guid'${listId}')/items(${itemId})?$select=${encodeURIComponent(select)}`,
    headers: jsonHeaders,
  })
  return data ?? {}
}

/** Parse nilai JSON kolom Image → URL gambar absolut (atau null). */
export function parseThumbnailUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as { serverUrl?: string; serverRelativeUrl?: string }
    if (parsed.serverRelativeUrl) {
      return `${parsed.serverUrl ?? serverUrl}${parsed.serverRelativeUrl}`
    }
  } catch {
    // bukan JSON thumbnail
  }
  return null
}
