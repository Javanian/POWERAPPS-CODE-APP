import './audit.css'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Camera, CheckCircle2, Moon, Star, Sun, X } from 'lucide-react'
import type { AuditSetup } from './AuditSetupPage'
import { rootClassName, type Theme } from './theme'
import type { _5RNewAppsWrite } from './generated/models/_5RNewAppsModel'
import {
  ALL_AUDIT_ITEMS,
  AUDIT_CATEGORIES,
  MAX_TOTAL_SCORE,
  SCORE_OPTIONS,
  createInitialAuditState,
  type AuditCategoryDef,
  type AuditItemDef,
  type AuditItemState,
} from './auditFormConfig'
import {
  buildThumbnailFieldValue,
  uploadEvidenceFileViaFlow,
  validateUpdateListItem,
  type EvidenceColumnEntry,
  type FormValue,
} from './evidenceImageColumn'
import { compressImage, extensionForType, makePreviewObjectUrl, validateImage } from './imagePrep'
import { getPowerAppsErrorMessage, getPowerAppsOperationErrorDetail, withPowerAppsTimeout } from './powerAppsData'
import { createSharePointListItem } from './uploadAttachment'

type FormMessage = {
  type: 'success' | 'error'
  text: string
}

type EvidenceUpload = {
  item: AuditItemDef
  file: File
}

type SavedResult = {
  id: number
  imageUpdatedCount: number
  failedFiles: string[]
  imageWarnings: string[]
}

function collectEvidenceUploads(auditState: Record<string, AuditItemState>): EvidenceUpload[] {
  const uploads: EvidenceUpload[] = []

  for (const item of ALL_AUDIT_ITEMS) {
    const evidence = auditState[item.id]?.evidence

    if (evidence) {
      uploads.push({ item, file: evidence })
    }
  }

  return uploads
}

type EvidencePickerProps = {
  itemId: string
  file: File | null
  disabled: boolean
  onChange: (file: File | null) => void
}

function EvidencePicker({ itemId, file, disabled, onChange }: EvidencePickerProps) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const previewUrl = file && preview?.file === file ? preview.url : null

  // Preview di-downscale async — hindari decode foto full-res di main thread.
  useEffect(() => {
    if (!file) return

    let cancelled = false
    let createdUrl: string | null = null

    makePreviewObjectUrl(file)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        createdUrl = url
        setPreview({ file, url })
      })
      .catch(() => {
        // Preview gagal dibuat: tampilkan placeholder tanpa gambar.
      })

    return () => {
      cancelled = true
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [file])

  const inputId = `evidence-${itemId}`

  return (
    <div className="au-evidence" style={{ position: 'relative' }}>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        onChange={(e) => {
          const nextFile = e.target.files?.[0] ?? null

          if (nextFile) {
            try {
              validateImage(nextFile)
            } catch (err) {
              setPickError(err instanceof Error ? err.message : String(err))
              e.target.value = ''
              return
            }
          }

          setPickError(null)
          onChange(nextFile)
        }}
      />
      <label htmlFor={inputId} className="au-evidence-label">
        {file && previewUrl ? (
          <span className="au-evidence-preview">
            <img className="au-evidence-thumb" src={previewUrl} alt={`Evidence ${itemId}`} decoding="async" />
            <span className="au-evidence-name">
              {file.name}
              <span className="au-evidence-hint"> ({(file.size / 1024).toFixed(1)} KB)</span>
            </span>
            <button
              type="button"
              className="au-evidence-remove"
              aria-label="Hapus evidence"
              onClick={(e) => {
                e.preventDefault()
                onChange(null)
              }}
            >
              <X size={16} />
            </button>
          </span>
        ) : (
          <>
            <Camera size={26} />
            <span>Ambil foto atau pilih file gambar</span>
            <span className="au-evidence-hint">JPG / PNG, maks 20 MB (dikompres otomatis)</span>
          </>
        )}
      </label>
      {pickError ? <p className="au-evidence-error">{pickError}</p> : null}
    </div>
  )
}

type AuditFormPageProps = {
  setup: AuditSetup
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
  onDone: () => void
}

/** Topbar audit — back + judul + toggle tema, sekelas landing page. */
function AuditTopBar({
  theme,
  onToggleTheme,
  onBack,
  eyebrow,
  name,
  accent,
}: {
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
  eyebrow: string
  name: string
  accent?: { color: string; colorText: string }
}) {
  return (
    <header className="lp-topbar">
      <button type="button" className="au-iconbtn" onClick={onBack} aria-label="Kembali">
        <ArrowLeft size={18} />
      </button>
      <div className="au-topbar-title">
        <span className="au-topbar-eyebrow">{eyebrow}</span>
        <span className="au-topbar-name">
          {accent ? (
            <span
              className="au-cat-badge"
              style={{
                background: accent.color,
                color: accent.colorText,
                width: 22,
                height: 22,
                borderRadius: 7,
                fontSize: 11,
                display: 'inline-grid',
                verticalAlign: 'middle',
                marginRight: 8,
              }}
            >
              {name.slice(0, 2)}
            </span>
          ) : null}
          {name}
        </span>
      </div>
      <button
        type="button"
        className="au-iconbtn"
        onClick={onToggleTheme}
        aria-label={theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang'}
      >
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </header>
  )
}

export function AuditFormPage({ setup, theme, onToggleTheme, onBack, onDone }: AuditFormPageProps) {
  const [activeCategory, setActiveCategory] = useState<AuditCategoryDef | null>(null)
  const [auditState, setAuditState] = useState<Record<string, AuditItemState>>(createInitialAuditState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<FormMessage | null>(null)
  const [saved, setSaved] = useState<SavedResult | null>(null)

  function updateItem(itemId: string, patch: Partial<AuditItemState>) {
    setAuditState((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
  }

  const totalScore = useMemo(
    () =>
      ALL_AUDIT_ITEMS.reduce((sum, item) => {
        const score = auditState[item.id]?.score
        return score === '' || score === undefined ? sum : sum + Number(score)
      }, 0),
    [auditState],
  )

  const unscoredCount = useMemo(
    () => ALL_AUDIT_ITEMS.filter((item) => auditState[item.id]?.score === '').length,
    [auditState],
  )

  // Score 0/3 = temuan → foto WAJIB. Score 5 = compliant, foto opsional.
  const missingEvidenceItems = useMemo(
    () =>
      ALL_AUDIT_ITEMS.filter((item) => {
        const state = auditState[item.id]
        return (state?.score === '0' || state?.score === '3') && !state?.evidence
      }),
    [auditState],
  )

  const starCount = totalScore > 0 ? Math.round((totalScore / MAX_TOTAL_SCORE) * 5) : 0

  function categorySubtotal(category: AuditCategoryDef) {
    return category.items.reduce((sum, item) => {
      const score = auditState[item.id]?.score
      return score === '' || score === undefined ? sum : sum + Number(score)
    }, 0)
  }

  function categoryFilledCount(category: AuditCategoryDef) {
    return category.items.filter((item) => auditState[item.id]?.score !== '').length
  }

  function categoryMissingEvidence(category: AuditCategoryDef) {
    return category.items.filter((item) => {
      const state = auditState[item.id]
      return (state?.score === '0' || state?.score === '3') && !state?.evidence
    }).length
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }

    setMessage(null)

    if (unscoredCount > 0) {
      setMessage({ type: 'error', text: `${unscoredCount} item audit belum dinilai. Lengkapi semua score dulu.` })
      return
    }

    if (missingEvidenceItems.length > 0) {
      const labels = missingEvidenceItems.map((item) => item.label).join(', ')
      setMessage({
        type: 'error',
        text: `Foto wajib untuk item dengan score 0/3: ${labels}. Lampirkan evidence dulu.`,
      })
      return
    }

    const uploads = collectEvidenceUploads(auditState)

    setIsSubmitting(true)
    let createdId: number | undefined

    try {
      const dateFormatted = setup.tanggalPelaksanaan.replace(/-/g, '')
      const payload: Omit<_5RNewAppsWrite, 'ID'> = {
        Title: `5R_${setup.area5R}_${dateFormatted}`,
        Plant_x002f_Site: setup.plantSite || undefined,
        Area5R: setup.area5R || undefined,
        TanggalPelaksanaan: setup.tanggalPelaksanaan || undefined,
        // Kolom person WAJIB dikirim sebagai objek SPListExpandedUser.
        // Key "Auditor#Claims" ditolak PostItem (400 field could not be found).
        Auditor: setup.auditorPerson,
        TotalScore: totalScore,
        // Audit baru selalu berstatus New; lifecycle follow-up (New → On Progress
        // → Closed) diubah dari halaman Follow Up. Casing harus persis dengan
        // choice SharePoint, kalau tidak nilainya tidak tersimpan / tak ter-filter.
        StatusActionPlan: 'New',
      }
      const dynamicPayload = payload as Record<string, unknown>

      for (const item of ALL_AUDIT_ITEMS) {
        const state = auditState[item.id]

        if (state.score !== '') {
          dynamicPayload[item.scoreField] = Number(state.score)
        }

        if (state.keterangan.trim()) {
          dynamicPayload[item.keteranganField] = state.keterangan.trim()
        }

        if (state.actionPlan.trim()) {
          dynamicPayload[item.actionPlanField] = state.actionPlan.trim()
        }
      }

      console.info('5R Audit — submitting payload:', JSON.stringify(payload, null, 2))

      const result = await withPowerAppsTimeout(createSharePointListItem(payload))

      if (!result.success) {
        throw new Error(`Gagal menyimpan: ${getPowerAppsOperationErrorDetail(result.error)}`)
      }

      createdId = result.data?.ID

      if (!createdId) {
        throw new Error('Item sudah dibuat, tapi response tidak mengembalikan ID item.')
      }

      // Pipeline evidence: kompres → upload byte via FLOW (satu-satunya jalur
      // binary yang valid) → kumpulkan → SATU ValidateUpdateListItem untuk
      // semua kolom image sekaligus.
      const failedFiles: string[] = []
      const imageWarnings: string[] = []
      const columnEntries: EvidenceColumnEntry[] = []

      for (let index = 0; index < uploads.length; index += 1) {
        const upload = uploads[index]
        setMessage({
          type: 'success',
          text: `Data audit tersimpan (ID ${createdId}). Upload evidence ${index + 1}/${uploads.length}: ${upload.item.label}`,
        })

        try {
          // Kompres dulu — base64 menggembungkan payload ~33%.
          let content: Blob = upload.file

          try {
            content = await compressImage(upload.file)
          } catch (err) {
            console.info(`Kompresi gagal untuk ${upload.item.label}, memakai file asli:`, err)
          }

          // Nama unik WAJIB — folder SiteAssets/Lists/{guid} datar; nama sama
          // akan menimpa file lama tanpa error.
          const fileName = `${upload.item.evidencePrefix}_${crypto.randomUUID()}.${extensionForType(content.type)}`
          const uploaded = await withPowerAppsTimeout(uploadEvidenceFileViaFlow(fileName, content), 90000)
          columnEntries.push({
            internalName: upload.item.imageFieldInternalName,
            displayName: upload.item.imageFieldDisplayName,
            uploaded,
          })
        } catch (err) {
          console.info(`Upload evidence gagal (${upload.item.label}):`, err)
          failedFiles.push(upload.file.name)
          imageWarnings.push(`${upload.item.label}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // Title final = "ID <itemId>" (ID baru tersedia setelah item dibuat) +
      // kolom foto, ditulis dalam SATU ValidateUpdateListItem.
      const finalFormValues: FormValue[] = [{ FieldName: 'Title', FieldValue: `ID ${createdId}` }]
      for (const entry of columnEntries) {
        finalFormValues.push({
          FieldName: entry.internalName,
          FieldValue: buildThumbnailFieldValue(entry.displayName, entry.uploaded),
        })
      }

      let imageUpdatedCount = 0
      try {
        await withPowerAppsTimeout(validateUpdateListItem(createdId, finalFormValues), 30000)
        imageUpdatedCount = columnEntries.length
      } catch (err) {
        console.info('Penulisan Title/kolom image gagal:', err)
        imageWarnings.push(
          `Update Title/kolom image gagal: ${err instanceof Error ? err.message : String(err)}${
            columnEntries.length ? ' — file sudah terupload, kolom bisa diisi ulang.' : ''
          }`,
        )
      }

      setMessage(null)
      setSaved({
        id: createdId,
        imageUpdatedCount,
        failedFiles,
        imageWarnings,
      })
    } catch (err) {
      const context = createdId
        ? `Data audit sudah tersimpan dengan ID ${createdId}, tapi proses berikutnya gagal`
        : 'Gagal menyimpan data audit'
      setMessage({ type: 'error', text: getPowerAppsErrorMessage(err, context) })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Halaman sukses ──
  if (saved) {
    return (
      <div className={rootClassName(theme)}>
        <div className="lp-sky" aria-hidden="true" />
        <AuditTopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onBack={onDone}
          eyebrow={`${setup.area5R} · ${setup.plantSite}`}
          name="Audit 5R"
        />
        <main className="au-main">
          <div className="au-success">
            <span className="au-success-icon">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="au-success-title">Audit tersimpan</h2>
            <p className="au-success-desc">
              ID item <strong>{saved.id}</strong> &middot; total score{' '}
              <strong>
                {totalScore}/{MAX_TOTAL_SCORE}
              </strong>{' '}
              &middot; {saved.imageUpdatedCount} kolom foto terisi.
            </p>
            {saved.failedFiles.length > 0 ? (
              <div className="au-msg au-msg-error">
                Upload gagal untuk: {saved.failedFiles.join(', ')}. Data audit tetap tersimpan — evidence bisa
                ditambahkan manual di SharePoint (item ID {saved.id}).
              </div>
            ) : null}
            {saved.imageWarnings.length > 0 ? (
              <div className="au-msg au-msg-error">
                {saved.imageWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
            <button type="button" className="au-btn au-btn-primary au-btn-full" onClick={onDone}>
              Kembali ke halaman utama
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Halaman detail kategori ──
  if (activeCategory) {
    const category = activeCategory

    return (
      <div className={rootClassName(theme)}>
        <div className="lp-sky" aria-hidden="true" />
        <AuditTopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onBack={() => setActiveCategory(null)}
          eyebrow={category.key}
          name={category.name}
          accent={{ color: category.color, colorText: category.colorText }}
        />

        <main className="au-main">
          <p className="au-context-line" style={{ margin: '10px 2px 16px' }}>
            {category.desc}
          </p>

          {category.items.map((item: AuditItemDef) => {
            const state = auditState[item.id]
            const evidenceRequired = state.score === '0' || state.score === '3'

            return (
              <div key={item.id} className="au-card au-item-card" style={{ borderLeftColor: category.color }}>
                <h2 className="au-item-title">{item.label}</h2>

                <div className="au-field">
                  <span className="au-field-label">
                    Score <strong>*</strong>
                  </span>
                  <div className="au-seg" role="radiogroup" aria-label={`Score ${item.label}`}>
                    {SCORE_OPTIONS.map((option) => {
                      const isActive = state.score === option

                      return (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          className={`au-seg-btn${isActive ? ' is-active' : ''}`}
                          style={
                            isActive
                              ? { background: category.color, borderColor: category.color, color: category.colorText }
                              : undefined
                          }
                          onClick={() => updateItem(item.id, { score: option })}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="au-field">
                  <span className="au-field-label">Keterangan / Temuan</span>
                  <textarea
                    className="au-textarea"
                    value={state.keterangan}
                    onChange={(e) => updateItem(item.id, { keterangan: e.target.value })}
                    placeholder={`Deskripsikan kondisi terkait ${item.label.toLowerCase()}...`}
                    rows={3}
                  />
                </label>

                <div className="au-field">
                  <span className="au-field-label">
                    Evidence (Foto){evidenceRequired ? <strong> *</strong> : null}
                  </span>
                  <EvidencePicker
                    itemId={item.id}
                    file={state.evidence}
                    disabled={isSubmitting}
                    onChange={(file) => updateItem(item.id, { evidence: file })}
                  />
                  {evidenceRequired && !state.evidence ? (
                    <p className="au-evidence-error">Wajib lampirkan foto untuk score {state.score}.</p>
                  ) : null}
                </div>
              </div>
            )
          })}

          <div className="au-actions">
            <button type="button" className="au-btn au-btn-primary" onClick={() => setActiveCategory(null)}>
              Simpan &amp; kembali
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Halaman menu 5R ──
  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />
      <AuditTopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        eyebrow="Audit"
        name="Audit 5R"
      />

      <main className="au-main">
        <div className="au-context">
          <p className="au-context-eyebrow">Sesi audit</p>
          <p className="au-context-line">
            <strong>{setup.auditorDisplayName}</strong> &middot; {setup.area5R} &middot; {setup.plantSite} &middot;{' '}
            {setup.tanggalPelaksanaan}
          </p>
        </div>

        <div className="au-card">
          <div className="au-menu-head">
            <span>Item Audit</span>
            <span>Score</span>
          </div>
          <div className="au-menu-list">
            {AUDIT_CATEGORIES.map((category) => {
              const filled = categoryFilledCount(category)
              const total = category.items.length
              const isComplete = filled === total
              const catMissing = categoryMissingEvidence(category)

              return (
                <button
                  key={category.key}
                  type="button"
                  className="au-cat-row"
                  onClick={() => {
                    setMessage(null)
                    setActiveCategory(category)
                  }}
                  disabled={isSubmitting}
                >
                  <span className="au-cat-body" style={{ borderLeftColor: category.color }}>
                    <span
                      className="au-cat-badge"
                      style={{ background: category.color, color: category.colorText }}
                    >
                      {category.key}
                    </span>
                    <span className="au-cat-text">
                      <span className="au-cat-name">{category.name}</span>
                      <span className="au-cat-progress">
                        <span className="au-progress-track">
                          <span
                            className="au-progress-fill"
                            style={{ width: `${(filled / total) * 100}%`, background: category.color }}
                          />
                        </span>
                        <span className="au-cat-count">
                          {filled}/{total}
                          {isComplete ? ' ✓' : ''}
                          {catMissing > 0 ? (
                            <span style={{ color: '#e03131', fontWeight: 700 }}> · butuh {catMissing} foto</span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="au-score-chip" style={{ background: category.tint, borderColor: category.color }}>
                    {categorySubtotal(category)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="au-card au-score-card">
          <div>
            <div className="au-score-label">Total Score</div>
            <div className="au-score-total">
              {totalScore}
              <span className="au-score-max">/{MAX_TOTAL_SCORE}</span>
            </div>
          </div>
          <div>
            <div className="au-score-label" style={{ textAlign: 'right' }}>
              Star Rating
            </div>
            <div className="au-stars" aria-label={`${starCount} dari 5 bintang`}>
              {[1, 2, 3, 4, 5].map((star) => {
                const on = star <= starCount
                return (
                  <Star
                    key={star}
                    size={28}
                    className={`au-star${on ? ' is-on' : ''}`}
                    fill={on ? 'currentColor' : 'none'}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {message ? <div className={`au-msg au-msg-${message.type}`}>{message.text}</div> : null}

        <div className="au-actions">
          <button
            type="button"
            className="au-btn au-btn-primary au-btn-full"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Menyimpan...' : 'Submit Audit'}
          </button>
        </div>
        {unscoredCount > 0 && !isSubmitting ? (
          <p className="au-submit-hint">{unscoredCount} item belum dinilai — buka tiap kategori untuk mengisi score.</p>
        ) : null}
        {unscoredCount === 0 && missingEvidenceItems.length > 0 && !isSubmitting ? (
          <p className="au-submit-hint" style={{ color: '#e03131' }}>
            {missingEvidenceItems.length} item score 0/3 belum ada foto — wajib dilampirkan sebelum submit.
          </p>
        ) : null}
      </main>
    </div>
  )
}
