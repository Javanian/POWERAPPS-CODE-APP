import './landing.css'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { rootClassName, TopBar, type ThemeProps } from './LandingPage'
import {
  getAreaAuditData,
  getCurrentAuditor,
  getDistinctFieldValues,
  toFieldDisplayString,
  type AreaAuditData,
  type CurrentAuditor,
} from './auditSetupData'
import type { AuditorValue } from './generated/models/_5RNewAppsModel'
import { withPowerAppsTimeout } from './powerAppsData'

export type AuditSetup = {
  auditorDisplayName: string
  auditorEmail: string
  auditorClaims: string
  /** Objek person untuk kolom Auditor — selalu terisi (lihat CurrentAuditor). */
  auditorPerson: AuditorValue
  plantSite: string
  tanggalPelaksanaan: string
  area5R: string
}

type AuditSetupPageProps = ThemeProps & {
  onBack: () => void
  onSubmit: (setup: AuditSetup) => void
}

function todayLocalIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

export function AuditSetupPage({ theme, onToggleTheme, onBack, onSubmit }: AuditSetupPageProps) {
  const [currentAuditor, setCurrentAuditor] = useState<CurrentAuditor | null>(null)
  const [areaData, setAreaData] = useState<AreaAuditData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [plantSite, setPlantSite] = useState('')
  const [tanggalPelaksanaan, setTanggalPelaksanaan] = useState(todayLocalIso())
  const [area5R, setArea5R] = useState('')

  const loadOptions = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [auditor, areas] = await Promise.all([
        withPowerAppsTimeout(getCurrentAuditor(), 30000),
        withPowerAppsTimeout(getAreaAuditData(), 30000),
      ])

      setCurrentAuditor(auditor)
      setAreaData(areas)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const plantOptions = useMemo(() => {
    if (!areaData) {
      return []
    }

    return getDistinctFieldValues(areaData.rows, areaData.plantFieldKey)
  }, [areaData])

  const areaOptions = useMemo(() => {
    if (!areaData || !plantSite) {
      return []
    }

    const rowsForPlant = areaData.rows.filter(
      (row) => toFieldDisplayString(row[areaData.plantFieldKey]) === plantSite,
    )

    return getDistinctFieldValues(rowsForPlant, areaData.areaFieldKey)
  }, [areaData, plantSite])

  function handlePlantChange(nextPlant: string) {
    setPlantSite(nextPlant)
    setArea5R('')
  }

  const canSubmit =
    !isLoading && Boolean(currentAuditor) && Boolean(plantSite) && Boolean(tanggalPelaksanaan) && Boolean(area5R)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!currentAuditor || !canSubmit) {
      return
    }

    onSubmit({
      auditorDisplayName: currentAuditor.displayName,
      auditorEmail: currentAuditor.email,
      auditorClaims: currentAuditor.claims,
      auditorPerson: currentAuditor.person,
      plantSite,
      tanggalPelaksanaan,
      area5R,
    })
  }

  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />

      <TopBar theme={theme} onToggleTheme={onToggleTheme} />

      <main className="lp-hero">
        <form className="lp-panel lp-panel-setup" onSubmit={handleSubmit}>
          <div>
            <p className="lp-eyebrow">Audit Baru</p>
            <h2 className="lp-panel-title">Setup Audit 5R</h2>
            <p className="lp-panel-desc">Lengkapi data berikut sebelum mulai mengisi form audit.</p>
          </div>

          {loadError ? (
            <div className="lp-alert" role="alert">
              <span>{loadError}</span>
              <button type="button" className="lp-btn-back" onClick={() => void loadOptions()}>
                Coba lagi
              </button>
            </div>
          ) : null}

          <label className="lp-field">
            <span className="lp-label">Nama Auditor</span>
            <input
              type="text"
              className="lp-control"
              value={
                isLoading
                  ? 'Memuat user yang login...'
                  : (currentAuditor?.displayName ?? 'User tidak terbaca')
              }
              disabled
              readOnly
            />
            {currentAuditor?.email ? (
              <span className="lp-field-hint">{currentAuditor.email}</span>
            ) : null}
          </label>

          <label className="lp-field">
            <span className="lp-label">
              Plant / Site <strong>*</strong>
            </span>
            <select
              className="lp-control"
              value={plantSite}
              onChange={(e) => handlePlantChange(e.target.value)}
              disabled={isLoading || plantOptions.length === 0}
              required
            >
              <option value="">{isLoading ? 'Memuat daftar plant...' : 'Pilih Plant/Site'}</option>
              {plantOptions.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
          </label>

          <label className="lp-field">
            <span className="lp-label">
              Tanggal Pelaksanaan <strong>*</strong>
            </span>
            <input
              type="date"
              className="lp-control"
              value={tanggalPelaksanaan}
              onChange={(e) => setTanggalPelaksanaan(e.target.value)}
              required
            />
          </label>

          <label className="lp-field">
            <span className="lp-label">
              Area 5R <strong>*</strong>
            </span>
            <select
              className="lp-control"
              value={area5R}
              onChange={(e) => setArea5R(e.target.value)}
              disabled={isLoading || !plantSite}
              required
            >
              <option value="">
                {!plantSite ? 'Pilih Plant/Site terlebih dahulu' : 'Pilih Area 5R'}
              </option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="lp-btn lp-btn-primary lp-btn-center" disabled={!canSubmit}>
            <span className="lp-btn-label">Submit</span>
            <ChevronRight className="lp-btn-chev" size={20} />
          </button>

          <button type="button" className="lp-btn-back lp-btn-back-center" onClick={onBack}>
            Kembali ke halaman utama
          </button>
        </form>
      </main>

      <footer className="lp-foot">5R Audit &middot; QHSE workplace audit</footer>
    </div>
  )
}
