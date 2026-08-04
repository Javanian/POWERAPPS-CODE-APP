import './audit.css'
import './followup.css'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Camera, CheckCircle2, ExternalLink, ImageOff, Moon, Sun, X } from 'lucide-react'
import { rootClassName, type Theme } from './LandingPage'
import { AUDIT_CATEGORIES, type AuditCategoryDef } from './auditFormConfig'
import {
  FOLLOWUP_STATUS_OPTIONS,
  getFollowUpDetail,
  saveFollowUp,
  type FollowUpItemState,
  type FollowUpRecord,
} from './followUpData'
import { validateImage } from './imagePrep'
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from './powerAppsData'

type FollowUpDetailPageProps = {
  record: FollowUpRecord
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
}

/** id item → warna kategori untuk aksen. */
const itemAccent = new Map<string, { color: string; colorText: string; key: string }>()
for (const category of AUDIT_CATEGORIES) {
  for (const item of category.items) {
    itemAccent.set(item.id, { color: category.color, colorText: category.colorText, key: category.key })
  }
}

/** Temuan = score 0/3 (item yang butuh tindakan follow-up). Score 5 = compliant. */
function isFinding(item: FollowUpItemState) {
  return item.score === '0' || item.score === '3'
}

/** Sudah ditindaklanjuti = ada teks action ATAU foto after (lama/baru). */
function isAddressed(item: FollowUpItemState) {
  return item.actionText.trim() !== '' || Boolean(item.afterImageUrl) || Boolean(item.newAfterPhoto)
}

/** Preview gambar SharePoint dengan fallback (request lintas-situs bisa gagal). */
function ImagePreview({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <a className="fu-img-fallback" href={url} target="_blank" rel="noreferrer">
        <ImageOff size={18} />
        <span>Buka di SharePoint</span>
        <ExternalLink size={13} />
      </a>
    )
  }

  return (
    <img
      className="fu-img"
      src={url}
      alt={label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

export function FollowUpDetailPage({ record, theme, onToggleTheme, onBack }: FollowUpDetailPageProps) {
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<FollowUpItemState[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError('')

    void withPowerAppsTimeout(getFollowUpDetail(record.id), 30000)
      .then((detail) => {
        if (cancelled) return
        setStatus(detail.status || record.status || 'New')
        setItems(detail.items)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getPowerAppsErrorMessage(err, 'Gagal memuat detail record'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [record.id, record.status])

  function updateItem(id: string, patch: Partial<FollowUpItemState>) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])

  // Item-state untuk satu kategori, urut sesuai definisi kategori.
  function categoryItems(category: AuditCategoryDef): FollowUpItemState[] {
    return category.items
      .map((ci) => itemsById.get(ci.id))
      .filter((it): it is FollowUpItemState => Boolean(it))
  }

  const activeCategory = activeCategoryKey
    ? AUDIT_CATEGORIES.find((c) => c.key === activeCategoryKey) ?? null
    : null

  const statusOptions = useMemo(() => {
    const opts = [...FOLLOWUP_STATUS_OPTIONS] as string[]
    if (status && !opts.includes(status)) opts.unshift(status)
    return opts
  }, [status])

  async function handleSave() {
    if (isSaving) return
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const result = await withPowerAppsTimeout(saveFollowUp(record.id, status, items), 120000)

      if (result.warnings.length > 0) {
        setSaveMessage({
          type: 'error',
          text: `Tersimpan sebagian. ${result.imageCount} foto after terupload. Gagal: ${result.warnings.join('; ')}`,
        })
      } else {
        setSaved(true)
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: getPowerAppsErrorMessage(err, 'Gagal menyimpan follow-up') })
    } finally {
      setIsSaving(false)
    }
  }

  if (saved) {
    return (
      <div className={rootClassName(theme)}>
        <div className="lp-sky" aria-hidden="true" />
        <TopBar theme={theme} onToggleTheme={onToggleTheme} onBack={onBack} title={record.title || `ID ${record.id}`} />
        <main className="au-main">
          <div className="au-success">
            <span className="au-success-icon">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="au-success-title">Follow-up tersimpan</h2>
            <p className="au-success-desc">
              Record <strong>{record.title || record.id}</strong> diperbarui dengan status{' '}
              <strong>{status}</strong>.
            </p>
            <button type="button" className="au-btn au-btn-primary au-btn-full" onClick={onBack}>
              Kembali ke daftar
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onBack={activeCategory ? () => setActiveCategoryKey(null) : onBack}
        title={activeCategory ? activeCategory.name : record.title || `ID ${record.id}`}
      />

      <main className="au-main">
        {loadError ? <div className="au-msg au-msg-error">{loadError}</div> : null}

        {isLoading ? (
          <div className="fu-skeleton-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="au-card fu-skeleton" />
            ))}
          </div>
        ) : activeCategory ? (
          // ── Drill-down kategori: before (read-only) + kolom action (editable) ──
          <>
            <p className="au-context-line" style={{ margin: '10px 2px 16px' }}>
              {activeCategory.desc}
            </p>

            {categoryItems(activeCategory).map((item) => (
              <FollowUpItemCard
                key={item.id}
                item={item}
                accent={itemAccent.get(item.id)}
                disabled={isSaving}
                onUpdate={(patch) => updateItem(item.id, patch)}
              />
            ))}

            <div className="au-actions">
              <button
                type="button"
                className="au-btn au-btn-primary"
                onClick={() => setActiveCategoryKey(null)}
              >
                Kembali ke menu
              </button>
            </div>
          </>
        ) : (
          // ── Menu 5R: status + daftar kategori + simpan ──
          <>
            <div className="au-context">
              <p className="au-context-eyebrow">Follow-up · {record.area5R}</p>
              <p className="au-context-line">
                <strong>{record.auditor || '-'}</strong> &middot; {record.plantSite} &middot; PIC{' '}
                {record.picArea || '-'} &middot; score {record.totalScore}/50
              </p>
            </div>

            <div className="au-card fu-status-card">
              <span className="au-field-label">Status Action Plan</span>
              <select className="fu-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="au-card">
              <div className="au-menu-head">
                <span>Item Audit</span>
                <span>Temuan</span>
              </div>
              <div className="au-menu-list">
                {AUDIT_CATEGORIES.map((category) => {
                  const catItems = categoryItems(category)
                  const findings = catItems.filter(isFinding)
                  const addressed = findings.filter(isAddressed).length
                  const done = findings.length > 0 && addressed === findings.length

                  return (
                    <button
                      key={category.key}
                      type="button"
                      className="au-cat-row"
                      onClick={() => {
                        setSaveMessage(null)
                        setActiveCategoryKey(category.key)
                      }}
                      disabled={isSaving}
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
                            {findings.length > 0 ? (
                              <>
                                <span className="au-progress-track">
                                  <span
                                    className="au-progress-fill"
                                    style={{
                                      width: `${(addressed / findings.length) * 100}%`,
                                      background: category.color,
                                    }}
                                  />
                                </span>
                                <span className="au-cat-count">
                                  {addressed}/{findings.length} action{done ? ' ✓' : ''}
                                </span>
                              </>
                            ) : (
                              <span className="au-cat-count">Tidak ada temuan</span>
                            )}
                          </span>
                        </span>
                      </span>
                      <span
                        className="au-score-chip"
                        style={{ background: category.tint, borderColor: category.color }}
                      >
                        {findings.length}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {saveMessage ? <div className={`au-msg au-msg-${saveMessage.type}`}>{saveMessage.text}</div> : null}

            <div className="au-actions">
              <button
                type="button"
                className="au-btn au-btn-primary au-btn-full"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Follow-up'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function TopBar({
  theme,
  onToggleTheme,
  onBack,
  title,
}: {
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
  title: string
}) {
  return (
    <header className="lp-topbar">
      <button type="button" className="au-iconbtn" onClick={onBack} aria-label="Kembali">
        <ArrowLeft size={18} />
      </button>
      <div className="au-topbar-title">
        <span className="au-topbar-eyebrow">Follow Up</span>
        <span className="au-topbar-name">{title}</span>
      </div>
      <button
        type="button"
        className="au-iconbtn"
        onClick={onToggleTheme}
        aria-label={theme === 'light' ? 'Mode gelap' : 'Mode terang'}
      >
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </header>
  )
}

/** Kartu satu item: before (read-only) + kolom Action Plan (editable). */
function FollowUpItemCard({
  item,
  accent,
  disabled,
  onUpdate,
}: {
  item: FollowUpItemState
  accent?: { color: string; colorText: string; key: string }
  disabled: boolean
  onUpdate: (patch: Partial<FollowUpItemState>) => void
}) {
  return (
    <div className="au-card au-item-card" style={{ borderLeftColor: accent?.color ?? '#0077b6' }}>
      <div className="fu-item-head">
        <span
          className="au-cat-badge fu-item-badge"
          style={{ background: accent?.color, color: accent?.colorText }}
        >
          {accent?.key}
        </span>
        <h2 className="au-item-title" style={{ marginBottom: 0 }}>
          {item.label}
        </h2>
      </div>

      {/* BEFORE — read only */}
      <div className="fu-before">
        <div className="fu-before-row">
          <span className="fu-tag">Score</span>
          <span className="fu-before-score">{item.score === '' ? '-' : item.score}</span>
        </div>
        {item.keterangan ? (
          <p className="fu-before-note">{item.keterangan}</p>
        ) : (
          <p className="fu-before-note fu-muted">Tidak ada keterangan.</p>
        )}
        <div className="fu-before-img">
          <span className="fu-tag">Evidence before</span>
          {item.beforeImageUrl ? (
            <ImagePreview url={item.beforeImageUrl} label={`Before ${item.label}`} />
          ) : (
            <span className="fu-no-img">Belum ada foto</span>
          )}
        </div>
      </div>

      {/* ACTION — editable */}
      <div className="fu-action" style={{ borderTopColor: accent?.color }}>
        <span className="fu-action-tag" style={{ color: accent?.color }}>
          Action Plan
        </span>

        <label className="au-field">
          <span className="au-field-label">Tindakan perbaikan</span>
          <textarea
            className="au-textarea"
            value={item.actionText}
            onChange={(e) => onUpdate({ actionText: e.target.value })}
            placeholder="Tuliskan tindakan perbaikan yang dilakukan..."
            rows={2}
          />
        </label>

        <div className="au-field">
          <span className="au-field-label">Evidence after (foto tindakan)</span>
          {item.afterImageUrl && !item.newAfterPhoto ? (
            <div className="fu-existing-after">
              <ImagePreview url={item.afterImageUrl} label={`After ${item.label}`} />
              <span className="fu-existing-note">Sudah ada — pilih file untuk mengganti.</span>
            </div>
          ) : null}
          <AfterPhotoPicker
            itemId={item.id}
            file={item.newAfterPhoto}
            disabled={disabled}
            onChange={(file) => onUpdate({ newAfterPhoto: file })}
          />
        </div>
      </div>
    </div>
  )
}

function AfterPhotoPicker({
  itemId,
  file,
  disabled,
  onChange,
}: {
  itemId: string
  file: File | null
  disabled: boolean
  onChange: (file: File | null) => void
}) {
  const [pickError, setPickError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const inputId = `after-${itemId}`

  return (
    <div className="au-evidence" style={{ position: 'relative' }}>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null
          if (next) {
            try {
              validateImage(next)
            } catch (err) {
              setPickError(err instanceof Error ? err.message : String(err))
              e.target.value = ''
              return
            }
          }
          setPickError(null)
          onChange(next)
        }}
      />
      <label htmlFor={inputId} className="au-evidence-label">
        {file && previewUrl ? (
          <span className="au-evidence-preview">
            <img className="au-evidence-thumb" src={previewUrl} alt="After" decoding="async" />
            <span className="au-evidence-name">
              {file.name}
              <span className="au-evidence-hint"> ({(file.size / 1024).toFixed(1)} KB)</span>
            </span>
            <button
              type="button"
              className="au-evidence-remove"
              aria-label="Hapus"
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
            <Camera size={24} />
            <span>Ambil / pilih foto tindakan</span>
            <span className="au-evidence-hint">JPG / PNG, maks 20 MB</span>
          </>
        )}
      </label>
      {pickError ? <p className="au-evidence-error">{pickError}</p> : null}
    </div>
  )
}
