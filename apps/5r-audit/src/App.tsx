import './App.css'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { LandingPage, type Theme } from './LandingPage'
import { AuditSetupPage, type AuditSetup } from './AuditSetupPage'
import { AuditFormPage } from './AuditFormPage'
import { FollowUpListPage } from './FollowUpListPage'
import { FollowUpDetailPage } from './FollowUpDetailPage'
import type { FollowUpRecord } from './followUpData'

type AppView = 'landing' | 'setup' | 'auditor' | 'followup' | 'followup-detail'

const themeStorageKey = '5r-theme'

function getInitialTheme(): Theme {
  try {
    return localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function App() {
  const [view, setView] = useState<AppView>('landing')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [auditSetup, setAuditSetup] = useState<AuditSetup | null>(null)
  const [followUpRecord, setFollowUpRecord] = useState<FollowUpRecord | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  // Stack view = sumber kebenaran; disinkronkan dengan history browser supaya tombol
  // back browser / gesture back HP mundur antar-halaman, bukan langsung menutup app.
  const viewStackRef = useRef<AppView[]>(['landing'])
  const allowExitRef = useRef(false)
  const seededRef = useRef(false)

  const pushView = useCallback((next: AppView) => {
    const stack = [...viewStackRef.current, next]
    viewStackRef.current = stack
    window.history.pushState({ depth: stack.length - 1 }, '')
    setView(next)
  }, [])

  // Tombol back di dalam app memakai jalur yang sama dengan back browser/HP.
  const goBack = useCallback(() => {
    window.history.back()
  }, [])

  const goToRoot = useCallback(() => {
    const depth = viewStackRef.current.length - 1
    if (depth > 0) {
      window.history.go(-depth)
    }
  }, [])

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true
      // Entri "penjaga" di atas entri host: back dari landing akan mengenai batas ini
      // sehingga bisa dicegat untuk konfirmasi keluar, bukan diam-diam menutup app.
      window.history.pushState({ depth: 0 }, '')
    }

    function onPopState(event: PopStateEvent) {
      const state = event.state as { depth?: number } | null

      // Back melewati root app → tawarkan konfirmasi keluar, lalu pasang ulang penjaga.
      if (!state || typeof state.depth !== 'number') {
        if (allowExitRef.current) {
          allowExitRef.current = false
          return // user sudah konfirmasi: biarkan browser benar-benar keluar dari app
        }
        setExitOpen(true)
        window.history.pushState({ depth: 0 }, '')
        viewStackRef.current = ['landing']
        setView('landing')
        return
      }

      // Navigasi normal antar-halaman di dalam app.
      const targetDepth = state.depth
      const stack = viewStackRef.current.slice(0, targetDepth + 1)
      const nextView = stack[targetDepth] ?? 'landing'
      viewStackRef.current = stack
      setView(nextView)
      setExitOpen(false)
      if (nextView === 'landing') {
        setAuditSetup(null)
        setFollowUpRecord(null)
      }
    }

    window.addEventListener('popstate', onPopState)

    // Cegat refresh / tutup tab (X): hanya prompt generik bawaan browser yang mungkin,
    // dan itu pun tidak selalu tampil di HP atau di dalam host Power Apps.
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(themeStorageKey, next)
      } catch {
        // localStorage bisa diblokir di host tertentu — pilihan tema cukup untuk sesi ini
      }
      return next
    })
  }, [])

  const confirmExit = useCallback(() => {
    allowExitRef.current = true
    setExitOpen(false)
    window.history.back()
  }, [])

  let page: ReactElement

  if (view === 'setup') {
    page = (
      <AuditSetupPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={goBack}
        onSubmit={(setup) => {
          setAuditSetup(setup)
          pushView('auditor')
        }}
      />
    )
  } else if (view === 'auditor' && auditSetup) {
    page = (
      <AuditFormPage
        setup={auditSetup}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={goBack}
        onDone={goToRoot}
      />
    )
  } else if (view === 'followup') {
    page = (
      <FollowUpListPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={goBack}
        onOpenRecord={(record) => {
          setFollowUpRecord(record)
          pushView('followup-detail')
        }}
      />
    )
  } else if (view === 'followup-detail' && followUpRecord) {
    page = (
      <FollowUpDetailPage
        record={followUpRecord}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={goBack}
      />
    )
  } else {
    page = (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuditor={() => pushView('setup')}
        onOpenFollowUp={() => pushView('followup')}
      />
    )
  }

  return (
    <>
      {page}
      {exitOpen ? (
        <ExitConfirm theme={theme} onCancel={() => setExitOpen(false)} onConfirm={confirmExit} />
      ) : null}
    </>
  )
}

type ExitConfirmProps = {
  theme: Theme
  onCancel: () => void
  onConfirm: () => void
}

function ExitConfirm({ theme, onCancel, onConfirm }: ExitConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="exit-overlay"
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-title"
      onClick={onCancel}
    >
      <div className="exit-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="exit-title" className="exit-title">
          Keluar dari aplikasi?
        </h2>
        <p className="exit-desc">
          Kamu akan menutup aplikasi 5R Audit. Data yang belum disimpan bisa hilang.
        </p>
        <div className="exit-actions">
          <button type="button" ref={cancelRef} className="exit-btn exit-btn-ghost" onClick={onCancel}>
            Batal
          </button>
          <button type="button" className="exit-btn exit-btn-danger" onClick={onConfirm}>
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
