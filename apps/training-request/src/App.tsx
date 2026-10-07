import './App.css'
import './theme.css'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Calendar, Database, Target, FileText, ExternalLink, GraduationCap, ArrowRight } from 'lucide-react'
import { getContext } from '@microsoft/power-apps/app'
import { AdminPortal } from './AdminPortal'
import { TccdList } from './TccdList'
import { TccdRequestForm } from './TccdRequestForm'
import { canCurrentUserOpenAdminPortal } from './adminAccess'

type IconName =
  | 'request'
  | 'approval'
  | 'calendar'
  | 'visibility'
  | 'speed'
  | 'control'
  | 'data'
  | 'objective'
  | 'participants'
  | 'submit'
  | 'note'

type Step = {
  number: string
  title: string
  description: string
}

type UserGuideStep = {
  title: string
  description: string
  icon: IconName
  bullets?: string[]
}

type ResourceLink = {
  title: string
  description: string
  url: string
  icon: IconName
  accent: string
}

type Page = 'home' | 'requests' | 'request-form' | 'admin'

const fadeLeft: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.06,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
}

const fadeRight: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.06,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
}

const userGuideSteps: UserGuideStep[] = [
  {
    title: 'Isi Data',
    description: 'Lengkapi informasi training atau sertifikasi dengan benar sebelum melanjutkan ke pengisian peserta.',
    icon: 'data',
  },
  {
    title: 'Jelaskan Kebutuhan',
    description: 'Isi justification dan objective secara jelas, terukur, dan relevan dengan kebutuhan tim.',
    icon: 'objective',
  },
  {
    title: 'Tambahkan Peserta',
    description: 'Masukkan peserta sesuai tipe kebutuhan dan pastikan data peserta sudah sesuai sebelum submit.',
    icon: 'participants',
    bullets: [
      'Isi ID karyawan untuk peserta internal',
      'Isi manual untuk mitra kerja atau eksternal',
      'Klik Add Participant untuk menambah peserta',
      'Klik Remove untuk menghapus peserta',
    ],
  },
  {
    title: 'Submit & Pantau',
    description: 'Ajukan request dan pantau status pengajuan hingga selesai melalui halaman data request.',
    icon: 'submit',
  },
  {
    title: 'Catatan',
    description: 'Kolom bertanda (*) wajib diisi agar request dapat diproses dengan lengkap.',
    icon: 'note',
  },
]

const steps: Step[] = [
  {
    number: '01',
    title: 'Ajukan Kebutuhan',
    description: 'User mengajukan training atau sertifikasi sesuai kebutuhan tim atau departemen.',
  },
  {
    number: '02',
    title: 'Review Awal',
    description: 'tim Learning & Development memeriksa kelengkapan data, urgensi, dan kesesuaian kebutuhan.',
  },
  {
    number: '03',
    title: 'Proses Approval',
    description: 'Pengajuan diteruskan ke atasan atau pihak terkait untuk mendapatkan persetujuan.',
  },
  {
    number: '04',
    title: 'Penjadwalan & Monitoring',
    description: 'Training atau sertifikasi dijadwalkan, dan status pengajuan dapat dipantau hingga pelaksanaan.',
  },
]

const resourceLinks: ResourceLink[] = [
  {
    title: 'Training Calendar',
    description: 'Lihat jadwal training yang tersedia dan rencana pelaksanaan terbaru.',
    url: 'https://example.com/training-calendar',
    icon: 'calendar',
    accent: 'blue',
  },
  {
    title: 'Learning Catalogue',
    description: 'Jelajahi katalog learning sebagai referensi kebutuhan pengembangan.',
    url: 'https://example.com/learning-catalogue',
    icon: 'data',
    accent: 'green',
  },
  {
    title: 'Competency Dictionary',
    description: 'Gunakan kamus kompetensi untuk menyelaraskan objektif training.',
    url: 'https://example.com/competency-dictionary',
    icon: 'objective',
    accent: 'gold',
  },
  {
    title: 'User Guide for Request Submission',
    description: 'Panduan untuk membuat dan mengajukan permintaan pelatihan.',
    url: 'https://example.com/request-guide',
    icon: 'note',
    accent: 'teal',
  },
]

const resourceLinkIcons: Record<string, typeof ExternalLink> = {
  calendar: Calendar,
  data: Database,
  objective: Target,
  note: FileText,
}

function App() {
  const [page, setPage] = useState<Page>(() => getPageFromHash())
  const [userName, setUserName] = useState('User')
  const [canOpenAdminPortal, setCanOpenAdminPortal] = useState(false)

  useEffect(() => {
    function handleHashChange() {
      setPage(getPageFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => {
    let isMounted = true

    getPowerAppsUserName()
      .then((name) => {
        if (isMounted) {
          setUserName(name)
        }
      })
      .catch(() => {
        if (isMounted) {
          setUserName('User')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    canCurrentUserOpenAdminPortal()
      .then((hasAccess) => {
        if (isMounted) {
          setCanOpenAdminPortal(hasAccess)
        }
      })
      .catch(() => {
        if (isMounted) {
          setCanOpenAdminPortal(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="app-shell">
      <AppHeader page={page} userName={userName} canOpenAdminPortal={canOpenAdminPortal} />
      {page === 'home' ? <LandingPage userName={userName} canOpenAdminPortal={canOpenAdminPortal} /> : null}
      {page === 'requests' ? <TccdList /> : null}
      {page === 'request-form' ? <TccdRequestForm /> : null}
      {page === 'admin' ? <AdminPortal /> : null}
    </main>
  )
}

const navItems: { page: Page; label: string; href: string; adminOnly?: boolean }[] = [
  { page: 'home', label: 'Beranda', href: '#/' },
  { page: 'requests', label: 'Pengajuan Saya', href: '#/requests' },
  { page: 'request-form', label: 'Buat Pengajuan', href: '#/request-form' },
  { page: 'admin', label: 'Portal Admin', href: '#/admin', adminOnly: true },
]

function AppHeader({
  page,
  userName,
  canOpenAdminPortal,
}: {
  page: Page
  userName: string
  canOpenAdminPortal: boolean
}) {
  const displayName = formatUserName(userName)

  return (
    <header className="app-header">
      <div className="app-header-inner section-container">
        <a className="app-brand" href="#/" aria-label="TCCD beranda">
          <span className="app-brand-mark" aria-hidden="true">
            <GraduationCap size={18} strokeWidth={2.2} />
          </span>
          <span className="app-brand-text">
            <strong>TCCD</strong>
            <span>Training &amp; Certification</span>
          </span>
        </a>
        <nav className="app-nav" aria-label="Navigasi utama">
          {navItems
            .filter((item) => !item.adminOnly || canOpenAdminPortal)
            .map((item) => (
              <a
                key={item.page}
                className={`app-nav-link ${page === item.page ? 'app-nav-link-active' : ''}`}
                href={item.href}
                aria-current={page === item.page ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
        </nav>
        <span className="app-user" title={displayName}>
          <span className="app-user-avatar" aria-hidden="true">
            {getInitials(displayName)}
          </span>
          <span className="app-user-name">{displayName}</span>
        </span>
      </div>
    </header>
  )
}

function LandingPage({
  userName,
  canOpenAdminPortal,
}: {
  userName: string
  canOpenAdminPortal: boolean
}) {
  return (
    <>
      <HeroSection userName={userName} canOpenAdminPortal={canOpenAdminPortal} />
      <UserGuideSection />
      <WorkflowSection />
      <CallToActionSection />
    </>
  )
}

function HeroSection({
  userName,
  canOpenAdminPortal,
}: {
  userName: string
  canOpenAdminPortal: boolean
}) {
  const displayName = formatUserName(userName)

  return (
    <section className="hero-section section-container" id="hero">
      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <span className="hero-greeting">
          {getTimeGreeting()}, {displayName}
        </span>
        <h1>Training &amp; Certification Control Document</h1>
        <p className="hero-lead">
          Ajukan training dan sertifikasi internal maupun eksternal, pantau status persetujuan, dan kelola
          peserta dalam satu tempat bersama tim Learning &amp; Development.
        </p>
        <div className="hero-actions" aria-label="Aksi utama">
          <a className="primary-button" href="#/request-form">
            Buat Pengajuan
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </a>
          <a className="secondary-button" href="#/requests">
            Lihat Pengajuan Saya
          </a>
          {canOpenAdminPortal ? (
            <a className="admin-entry-button" href="#/admin">
              Portal Admin
            </a>
          ) : null}
        </div>
      </motion.div>
      <aside className="hero-resources" aria-label="Akses cepat">
        <p className="resource-panel-label">Akses cepat</p>
        <div className="resource-link-grid">
          {resourceLinks.map((link, index) => (
            <ResourceLinkButton key={link.title} link={link} index={index} />
          ))}
        </div>
      </aside>
    </section>
  )
}

function ResourceLinkButton({ link, index }: { link: ResourceLink; index: number }) {
  const LinkIcon = resourceLinkIcons[link.icon] || ExternalLink
  return (
    <motion.a
      className={`resource-link-button resource-link-${link.accent}`}
      href={link.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.35, ease: 'easeOut' }}
    >
      <span className="resource-link-icon">
        <span className="icon-box">
          <LinkIcon size={20} strokeWidth={1.8} />
        </span>
      </span>
      <span className="resource-link-copy">
        <strong>{link.title}</strong>
        <span>{link.description}</span>
      </span>
      <span className="resource-link-arrow" aria-hidden="true">
        <ArrowRight size={16} strokeWidth={2} />
      </span>
    </motion.a>
  )
}

function UserGuideSection() {
  return (
    <section className="section-container page-section guide-section" id="guide">
      <SectionHeader
        title="Panduan Penggunaan"
        description="Ikuti langkah berikut agar request training atau sertifikasi lengkap, mudah direview, dan siap diproses."
      />
      <div className="guide-grid" aria-label="Panduan Penggunaan TCCD">
        {userGuideSteps.map((step, index) => (
          <GuideCard key={step.title} step={step} index={index + 1} />
        ))}
      </div>
    </section>
  )
}

function WorkflowSection() {
  return (
    <section className="workflow-band page-section" id="workflow">
      <div className="section-container workflow-layout">
        <SectionHeader
          title="Alur Pengajuan Training"
          description="Alur TCCD dibuat transparan agar requester dan tim Learning & Development dapat melihat posisi pengajuan dengan jelas."
        />
        <div className="timeline-steps" aria-label="Tahapan request training">
          {steps.map((step, index) => (
            <ProcessStep key={step.title} step={step} index={index + 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CallToActionSection() {
  return (
    <motion.section
      className="section-container cta-section"
      id="cta"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="cta-copy">
        <h2>Butuh pelatihan atau sertifikasi untuk tim Anda?</h2>
        <p>
          Ajukan melalui Form TCCD agar permintaan tercatat rapi dan dapat segera diproses oleh tim Learning & Development.
        </p>
      </div>
      <a className="primary-button cta-button" href="#/request-form">
        Buat Pengajuan
      </a>
    </motion.section>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      className="section-header"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <h2>{title}</h2>
      <p>{description}</p>
    </motion.div>
  )
}

function GuideCard({ step, index }: { step: UserGuideStep; index: number }) {
  const direction = index % 2 === 1 ? fadeLeft : fadeRight

  return (
    <motion.article
      className="guide-card"
      variants={direction}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      custom={index - 1}
    >
      <span className="guide-card-number">{index.toString().padStart(2, '0')}</span>
      <h3>{step.title}</h3>
      <p>{step.description}</p>
      {step.bullets ? (
        <ul>
          {step.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </motion.article>
  )
}

function ProcessStep({ step, index }: { step: Step; index: number }) {
  const direction = index % 2 === 1 ? fadeLeft : fadeRight

  return (
    <motion.article
      className="process-step"
      variants={direction}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      custom={index - 1}
    >
      <span className="step-number">{step.number}</span>
      <div>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
      </div>
    </motion.article>
  )
}
function getPageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '')

  if (hash === 'requests') {
    return 'requests'
  }

  if (hash === 'request-form') {
    return 'request-form'
  }

  if (hash === 'admin') {
    return 'admin'
  }

  return 'home'
}

async function getPowerAppsUserName() {
  try {
    const context = await Promise.race([getContext(), timeoutAfter(2500)])
    const fullName = context?.user?.fullName?.trim()
    const userPrincipalName = context?.user?.userPrincipalName?.trim()

    if (fullName) return fullName
    if (userPrincipalName) return userPrincipalName.split('@')[0].replace(/[._-]+/g, ' ')
  } catch {
    // Mobile player or dev mode — fallback
  }

  return 'User'
}

function timeoutAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Power Apps user context timeout.')), timeoutMs)
  })
}

function getTimeGreeting() {
  const hour = new Date().getHours()

  if (hour >= 4 && hour < 11) {
    return 'Selamat pagi'
  }

  if (hour >= 11 && hour < 15) {
    return 'Selamat siang'
  }

  if (hour >= 15 && hour < 18) {
    return 'Selamat sore'
  }

  return 'Selamat malam'
}

function formatUserName(userName: string) {
  return userName.trim() || 'User'
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'US'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export default App
