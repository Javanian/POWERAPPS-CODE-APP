import { useCallback, useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { NewRequestPanel } from './components/NewRequestPanel'
import {
  createRequest,
  decideRequest,
  getCurrentUser,
  listEmployees,
  listRequests,
  type CurrentUser,
  type NewRequest,
} from './data/overtimeRepository'
import type { OvertimeEmployee, OvertimeRequest } from './domain/overtime'
import { initials } from './format'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { RecapPage } from './pages/RecapPage'
import { RequestsPage } from './pages/RequestsPage'

type Page = 'requests' | 'approvals' | 'recap'

function pageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return hash === 'approvals' || hash === 'recap' ? hash : 'requests'
}

type Toast = { id: number; message: string }

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash)
  const [user, setUser] = useState<CurrentUser>({ name: 'User', email: '' })
  const [requests, setRequests] = useState<OvertimeRequest[]>([])
  const [employees, setEmployees] = useState<OvertimeEmployee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getCurrentUser(), listRequests(), listEmployees()])
      .then(([currentUser, requestRows, employeeRows]) => {
        if (!active) return
        setUser(currentUser)
        setRequests(requestRows)
        setEmployees(employeeRows)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Data belum bisa dimuat.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const closePanel = useCallback(() => setIsCreating(false), [])

  async function submitRequest(draft: NewRequest) {
    const created = await createRequest(draft, user)
    setRequests((current) => [created, ...current])
    setIsCreating(false)
    setToast({ id: Date.now(), message: `${created.number} terkirim ke atasan untuk disetujui.` })
  }

  async function decide(request: OvertimeRequest, status: 'Approved' | 'Rejected', note: string) {
    try {
      const updated = await decideRequest(request, status, note, user)
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setToast({ id: Date.now(), message: `${request.number} ${status === 'Approved' ? 'disetujui' : 'ditolak'}.` })
    } catch (error) {
      setToast({ id: Date.now(), message: error instanceof Error ? error.message : 'Keputusan belum tersimpan.' })
    }
  }

  const pendingCount = requests.filter((request) => request.status === 'Pending').length
  const nav: { page: Page; label: string; badge?: number }[] = [
    { page: 'requests', label: 'Pengajuan' },
    { page: 'approvals', label: 'Persetujuan', badge: pendingCount },
    { page: 'recap', label: 'Rekap' },
  ]

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true">
              <Timer size={18} strokeWidth={2.2} />
            </span>
            <span className="brand-text">Lembur</span>
          </a>
          <nav className="nav" aria-label="Navigasi utama">
            {nav.map((item) => (
              <a
                key={item.page}
                href={`#/${item.page}`}
                className={page === item.page ? 'nav-link nav-link-active' : 'nav-link'}
                aria-current={page === item.page ? 'page' : undefined}
              >
                {item.label}
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </a>
            ))}
          </nav>
          <span className="user" title={user.name}>
            <span className="avatar">{initials(user.name)}</span>
            <span className="user-name">{user.name}</span>
          </span>
        </div>
      </header>

      <main className="content">
        {isLoading ? (
          <div className="loading" role="status">
            Memuat data lembur…
          </div>
        ) : loadError ? (
          <div className="notice notice-error page">{loadError}</div>
        ) : page === 'approvals' ? (
          <ApprovalsPage requests={requests} onDecide={decide} />
        ) : page === 'recap' ? (
          <RecapPage requests={requests} />
        ) : (
          <RequestsPage requests={requests} onCreate={() => setIsCreating(true)} />
        )}
      </main>

      {isCreating ? (
        <NewRequestPanel employees={employees} existing={requests} onClose={closePanel} onSubmit={submitRequest} />
      ) : null}

      {toast ? (
        <div key={toast.id} className="toast" role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
