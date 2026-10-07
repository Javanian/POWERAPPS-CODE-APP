// SEMENTARA — halaman uji byte-fidelity CreateAttachment (connector, tanpa flow).
// Kalau vonisnya UTUH: jalur evidence bisa dipindah ke attachment dan flow pensiun.
// Hapus halaman ini (dan tombolnya di landing) setelah keputusan diambil.
import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { rootClassName, TopBar, type ThemeProps } from './LandingPage'
import { getListItemAttachmentInfo, verifyUploadedEvidence } from './evidenceImageColumn'
import { getPowerAppsOperationErrorDetail, withPowerAppsTimeout } from './powerAppsData'
import { create5RItemTestListItem, upload5RItemTestAttachment } from './uploadAttachment'

const testListGuid = '00000000-0000-4000-8000-000000000002' // list 5R_ITEM

type AttachmentTestPageProps = ThemeProps & {
  onBack: () => void
  onOpenOriginalForm?: () => void
}

export function AttachmentTestPage({ theme, onToggleTheme, onBack, onOpenOriginalForm }: AttachmentTestPageProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [lines, setLines] = useState<string[]>([])

  async function runTest() {
    if (!file || isRunning) {
      return
    }

    setIsRunning(true)
    const log: string[] = []

    const push = (line: string) => {
      log.push(line)
      setLines([...log])
      console.info(line)
    }

    try {
      push(`File asli: ${file.name} (${file.size} bytes)`)

      // 1. Buat item test di list 5R_ITEM.
      const created = await withPowerAppsTimeout(create5RItemTestListItem({ ID5R: `TEST_ATT_${Date.now()}` }))

      if (!created.success || !created.data?.ID) {
        throw new Error(`Create item 5R_ITEM gagal: ${getPowerAppsOperationErrorDetail(created.error)}`)
      }

      const itemId = created.data.ID
      push(`Item 5R_ITEM dibuat: ID ${itemId}`)

      // 2. Upload attachment via connector CreateAttachment — file MENTAH
      //    (tanpa kompresi) supaya perbandingan byte-nya murni.
      const dotIndex = file.name.lastIndexOf('.')
      const extension = dotIndex > 0 ? file.name.slice(dotIndex) : ''
      const fileName = `attchtest_${crypto.randomUUID()}${extension}`

      await withPowerAppsTimeout(upload5RItemTestAttachment({ itemId, fileName, file }), 90000)
      push(`CreateAttachment sukses: ${fileName}`)

      // 3. Baca balik path attachment via REST.
      const attachments = await withPowerAppsTimeout(getListItemAttachmentInfo(testListGuid, itemId))
      const match = (attachments?.value ?? []).find((attachment) => attachment.FileName === fileName)

      if (!match?.ServerRelativeUrl) {
        throw new Error('Attachment tidak ditemukan saat dibaca balik dari REST.')
      }

      push(`Path tersimpan: ${match.ServerRelativeUrl}`)

      // 4. Vonis: bandingkan ukuran tersimpan vs asli.
      try {
        await verifyUploadedEvidence(fileName, file.size, match.ServerRelativeUrl)
        push(`✅ UTUH — ukuran tersimpan = asli (${file.size} bytes). CreateAttachment mempertahankan byte!`)
        push('Konsekuensi: evidence bisa lewat attachment tanpa flow. Konfirmasi visual: buka path di atas.')
      } catch (err) {
        push(`❌ KORUP — ${err instanceof Error ? err.message : String(err)}`)
        push('Konsekuensi: klaim tetap berlaku — upload binary via connector rusak; flow tetap dipakai.')
      }
    } catch (err) {
      push(`Test gagal: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />

      <TopBar theme={theme} onToggleTheme={onToggleTheme} />

      <main className="lp-hero">
        <div className="lp-panel lp-panel-setup">
          <div>
            <p className="lp-eyebrow">Diagnostik</p>
            <h2 className="lp-panel-title">Test Upload Attachment</h2>
            <p className="lp-panel-desc">
              Menguji apakah CreateAttachment (connector, tanpa flow) menyimpan byte file secara utuh.
              Item test dibuat di list 5R_ITEM, lalu ukuran file dibaca balik dari REST.
            </p>
          </div>

          <label className="lp-field">
            <span className="lp-label">File gambar test</span>
            <input
              type="file"
              accept="image/*"
              className="lp-control"
              style={{ paddingTop: 10 }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="lp-field-hint">
                {file.name} — {file.size.toLocaleString('en-US')} bytes
              </span>
            ) : null}
          </label>

          <button
            type="button"
            className="lp-btn lp-btn-primary lp-btn-center"
            disabled={!file || isRunning}
            onClick={() => void runTest()}
          >
            <FlaskConical size={18} />
            <span className="lp-btn-label">{isRunning ? 'Menjalankan test...' : 'Jalankan test'}</span>
          </button>

          {lines.length > 0 ? (
            <div className="lp-test-result">
              {lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}

          {onOpenOriginalForm ? (
            <button type="button" className="lp-btn-back lp-btn-back-center" onClick={onOpenOriginalForm}>
              Buka form test versi awal (tanpa perubahan)
            </button>
          ) : null}

          <button type="button" className="lp-btn-back lp-btn-back-center" onClick={onBack}>
            Kembali ke halaman utama
          </button>
        </div>
      </main>

      <footer className="lp-foot">5R Audit &middot; QHSE workplace audit</footer>
    </div>
  )
}
