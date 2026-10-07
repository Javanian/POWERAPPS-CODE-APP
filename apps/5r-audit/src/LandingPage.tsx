import './landing.css'
import { ChevronRight, ClipboardCheck, ListChecks, Moon, Sun, Wrench } from 'lucide-react'
import gearLogo from './asset/5S_MR.png'
import brandLogo from './asset/brand.png'

const pillars = ['Ringkas', 'Rapi', 'Resik', 'Rawat', 'Rajin']

export type Theme = 'light' | 'dark'

export type ThemeProps = {
  theme: Theme
  onToggleTheme: () => void
}

export function TopBar({ theme, onToggleTheme }: ThemeProps) {
  return (
    <header className="lp-topbar">
      <img className="lp-logo" src={brandLogo} alt="5R Audit" />
      <div className="lp-topbar-right">
        <span className="lp-topbar-tag">QHSE</span>
        <button
          type="button"
          className="lp-theme-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}

export function rootClassName(theme: Theme) {
  return theme === 'light' ? 'lp-root lp-light' : 'lp-root'
}

type LandingPageProps = ThemeProps & {
  onOpenAuditor: () => void
  onOpenFollowUp: () => void
}

export function LandingPage({ theme, onToggleTheme, onOpenAuditor, onOpenFollowUp }: LandingPageProps) {
  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />

      <TopBar theme={theme} onToggleTheme={onToggleTheme} />

      <main className="lp-hero">
        <div className="lp-stage">
          <div className="lp-halo" aria-hidden="true" />
          <span className="lp-mote" aria-hidden="true" />
          <span className="lp-mote" aria-hidden="true" />
          <span className="lp-mote" aria-hidden="true" />
          <span className="lp-mote" aria-hidden="true" />
          <span className="lp-mote" aria-hidden="true" />
          <div className="lp-gear-wrap">
            <img className="lp-gear" src={gearLogo} alt="Logo 5S — Sort, Set-in-Order, Shine, Standardize, Sustain" />
          </div>
        </div>

        <p className="lp-eyebrow">Workplace Audit</p>
        <h1 className="lp-title">5R Audit</h1>
        <p className="lp-sub">
          Satu pintu untuk penilaian area kerja: dokumentasikan temuan di lapangan
          dan pastikan setiap perbaikan selesai.
        </p>

        <div className="lp-pillars">
          {pillars.map((name) => (
            <span key={name} className="lp-pillar">
              <span className="lp-pillar-tick" />
              <span className="lp-pillar-name">{name}</span>
            </span>
          ))}
        </div>

        <div className="lp-actions">
          <button type="button" className="lp-btn lp-btn-primary" onClick={onOpenAuditor}>
            <span className="lp-btn-icon">
              <ClipboardCheck size={22} />
            </span>
            <span className="lp-btn-text">
              <span className="lp-btn-label">Auditor</span>
              <span className="lp-btn-desc">Mulai audit &amp; isi penilaian area</span>
            </span>
            <ChevronRight className="lp-btn-chev" size={20} />
          </button>

          <button type="button" className="lp-btn lp-btn-ghost" onClick={onOpenFollowUp}>
            <span className="lp-btn-icon">
              <ListChecks size={22} />
            </span>
            <span className="lp-btn-text">
              <span className="lp-btn-label">Follow Up &amp; Audit</span>
              <span className="lp-btn-desc">Pantau temuan &amp; tindak lanjut perbaikan</span>
            </span>
            <ChevronRight className="lp-btn-chev" size={20} />
          </button>
        </div>
      </main>

      <footer className="lp-foot">5R Audit &middot; QHSE workplace audit</footer>
    </div>
  )
}

type FollowUpComingSoonProps = ThemeProps & {
  onBack: () => void
}

export function FollowUpComingSoon({ theme, onToggleTheme, onBack }: FollowUpComingSoonProps) {
  return (
    <div className={rootClassName(theme)}>
      <div className="lp-sky" aria-hidden="true" />

      <TopBar theme={theme} onToggleTheme={onToggleTheme} />

      <div className="lp-panel">
        <span className="lp-panel-icon">
          <Wrench size={26} />
        </span>
        <h2 className="lp-panel-title">Follow Up &amp; Audit</h2>
        <p className="lp-panel-desc">
          Modul ini sedang disiapkan. Nantinya semua temuan audit dan status tindak
          lanjutnya bisa dipantau dari sini.
        </p>
        <button type="button" className="lp-btn-back" onClick={onBack}>
          Kembali ke halaman utama
        </button>
      </div>

      <footer className="lp-foot">5R Audit &middot; QHSE workplace audit</footer>
    </div>
  )
}
