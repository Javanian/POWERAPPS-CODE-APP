import './audit.css'
import './followup.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Boxes, CalendarDays, ChevronRight, Loader2, Moon, Search, Sun, UserRound } from 'lucide-react'
import { rootClassName, type Theme } from './theme'
import {
  getAreaAuditData,
  getDistinctFieldValues,
  toFieldDisplayString,
  type AreaAuditData,
} from './auditSetupData'
import {
  FOLLOWUP_STATUS_OPTIONS,
  emptyFilters,
  getFollowUpRecords,
  type FollowUpFilters,
  type FollowUpRecord,
} from './followUpData'
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from './powerAppsData'

type FollowUpListPageProps = {
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
  onOpenRecord: (record: FollowUpRecord) => void
}

function statusTone(status: string): 'done' | 'progress' | 'open' | 'closed' | 'new' {
  const s = status.toLowerCase()
  if (s.includes('done')) return 'done'
  if (s.includes('progress')) return 'progress'
  if (s.includes('close')) return 'closed'
  if (s.includes('new')) return 'new'
  return 'open'
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function FollowUpListPage({ theme, onToggleTheme, onBack, onOpenRecord }: FollowUpListPageProps) {
  const [areaData, setAreaData] = useState<AreaAuditData | null>(null)
  const [draft, setDraft] = useState<FollowUpFilters>(emptyFilters)
  const [applied, setApplied] = useState<FollowUpFilters>(emptyFilters)

  const [records, setRecords] = useState<FollowUpRecord[]>([])
  const [lastId, setLastId] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const plantOptions = useMemo(
    () => (areaData ? getDistinctFieldValues(areaData.rows, areaData.plantFieldKey) : []),
    [areaData],
  )

  const areaOptions = useMemo(() => {
    if (!areaData) return []
    const rows = draft.plantSite
      ? areaData.rows.filter((row) => toFieldDisplayString(row[areaData.plantFieldKey]) === draft.plantSite)
      : areaData.rows
    return getDistinctFieldValues(rows, areaData.areaFieldKey)
  }, [areaData, draft.plantSite])

  const loadFirstPage = useCallback(async (filters: FollowUpFilters) => {
    setIsLoading(true)
    setError('')
    try {
      const page = await withPowerAppsTimeout(getFollowUpRecords(filters, 0), 30000)
      setRecords(page.records)
      setLastId(page.lastId)
      setHasMore(page.hasMore)
      setNotice(page.notice)
    } catch (err) {
      setError(getPowerAppsErrorMessage(err, 'Gagal memuat record'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      // Kartu dulu (prioritas) — baru dropdown filter (fetch Area Audit 5R
      // besar) di belakang, biar tidak memblok tampilnya list.
      await loadFirstPage(emptyFilters)
      getAreaAuditData()
        .then(setAreaData)
        .catch(() => setAreaData(null))
    })()
  }, [loadFirstPage])

  async function loadMore() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const page = await withPowerAppsTimeout(getFollowUpRecords(applied, lastId), 30000)
      setRecords((cur) => [...cur, ...page.records])
      setLastId(page.lastId)
      setHasMore(page.hasMore)
      if (page.notice) setNotice(page.notice)
    } catch (err) {
      setError(getPowerAppsErrorMessage(err, 'Gagal memuat halaman berikutnya'))
    } finally {
      setIsLoadingMore(false)
    }
  }

  function applyFilters() {
    setApplied(draft)
    void loadFirstPage(draft)
  }

  function resetFilters() {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    void loadFirstPage(emptyFilters)
  }

  const hasActiveFilter =
    applied.plantSite || applied.area5R || applied.status || applied.dateFrom || applied.dateTo || applied.search

  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />

      <header className="lp-topbar">
        <button type="button" className="au-iconbtn" onClick={onBack} aria-label="Kembali">
          <ArrowLeft size={18} />
        </button>
        <div className="au-topbar-title">
          <span className="au-topbar-eyebrow">QHSE</span>
          <span className="au-topbar-name">Follow Up &amp; Audit</span>
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

      <main className="au-main">
        {/* Filter bar */}
        <div className="au-card fu-filterbar">
          <form
            className="fu-search"
            onSubmit={(e) => {
              e.preventDefault()
              applyFilters()
            }}
          >
            <label className="fu-search-field">
              <Search size={16} />
              <input
                value={draft.search}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                placeholder="Cari label / no. audit..."
              />
            </label>
            <button type="submit" className="au-btn au-btn-primary fu-btn-sm" disabled={isLoading}>
              Terapkan
            </button>
          </form>

          <div className="fu-filter-grid">
            <label className="fu-field">
              <span>Plant / Site</span>
              <select
                className="fu-select"
                value={draft.plantSite}
                onChange={(e) => setDraft((d) => ({ ...d, plantSite: e.target.value, area5R: '' }))}
              >
                <option value="">Semua</option>
                {plantOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="fu-field">
              <span>Area 5R</span>
              <select
                className="fu-select"
                value={draft.area5R}
                onChange={(e) => setDraft((d) => ({ ...d, area5R: e.target.value }))}
              >
                <option value="">Semua</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="fu-field">
              <span>Status</span>
              <select
                className="fu-select"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              >
                <option value="">Semua</option>
                {FOLLOWUP_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="fu-field">
              <span>Dari tanggal</span>
              <input
                type="date"
                className="fu-select"
                value={draft.dateFrom}
                onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              />
            </label>

            <label className="fu-field">
              <span>Sampai tanggal</span>
              <input
                type="date"
                className="fu-select"
                value={draft.dateTo}
                onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              />
            </label>

            <div className="fu-field fu-field-actions">
              <button type="button" className="fu-btn-ghost" onClick={applyFilters} disabled={isLoading}>
                Terapkan filter
              </button>
              {hasActiveFilter ? (
                <button type="button" className="fu-btn-ghost" onClick={resetFilters}>
                  Reset
                </button>
              ) : null}
            </div>
          </div>
          {notice ? <p className="fu-notice">{notice}</p> : null}
        </div>

        {/* Hasil */}
        {error ? <div className="au-msg au-msg-error">{error}</div> : null}

        {isLoading ? (
          <div className="fu-skeleton-list">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="au-card fu-skeleton" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="au-card fu-empty">
            <Boxes size={26} />
            <p className="fu-empty-title">Tidak ada record</p>
            <p className="fu-empty-desc">
              {hasActiveFilter ? 'Coba ubah/atur ulang filter.' : 'Belum ada audit 5R yang tersimpan.'}
            </p>
          </div>
        ) : (
          <div className="fu-card-list">
            {records.map((rec, index) => (
              <button
                key={rec.id}
                type="button"
                className="au-card fu-card"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                onClick={() => onOpenRecord(rec)}
              >
                <div className="fu-card-head">
                  <span className="fu-card-title">{rec.title || `ID ${rec.id}`}</span>
                  <span className={`fu-status fu-status-${statusTone(rec.status)}`}>{rec.status || 'Open'}</span>
                </div>
                <div className="fu-card-meta">
                  <span>
                    <UserRound size={13} /> {rec.auditor || '-'}
                  </span>
                  <span>PIC: {rec.picArea || '-'}</span>
                  <span>
                    <CalendarDays size={13} /> {formatDate(rec.tanggal)}
                  </span>
                </div>
                <div className="fu-card-foot">
                  <span className="fu-chip">{rec.area5R || '-'}</span>
                  <span className="fu-chip fu-chip-muted">{rec.plantSite || '-'}</span>
                  <span className="fu-score">
                    {rec.totalScore}
                    <span className="fu-score-max">/50</span>
                  </span>
                  <ChevronRight size={18} className="fu-card-chev" />
                </div>
              </button>
            ))}

            {hasMore ? (
              <button type="button" className="fu-load-more" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 size={15} className="fu-spin" /> : null}
                {isLoadingMore ? 'Memuat...' : `Muat lebih banyak (${records.length} termuat)`}
              </button>
            ) : (
              <p className="fu-end">— semua record termuat ({records.length}) —</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
