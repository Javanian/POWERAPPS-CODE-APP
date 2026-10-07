import './App.css'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Calendar, Database, Target, FileText, ExternalLink } from 'lucide-react'
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
  hidden: { opacity: 0, x: -50, scale: 0.95, filter: 'blur(4px)' },
  show: (index: number = 0) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      delay: index * 0.12,
      duration: 0.6,
      ease: 'easeOut',
    },
  }),
}

const fadeRight: Variants = {
  hidden: { opacity: 0, x: 50, scale: 0.95, filter: 'blur(4px)' },
  show: (index: number = 0) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      delay: index * 0.12,
      duration: 0.6,
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
    description: 'Departemen Learning & Academy memeriksa kelengkapan data, urgensi, dan kesesuaian kebutuhan.',
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
    title: 'Training Calender',
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
      {page === 'home' ? <LandingPage userName={userName} canOpenAdminPortal={canOpenAdminPortal} /> : null}
      {page === 'requests' ? <TccdList /> : null}
      {page === 'request-form' ? <TccdRequestForm /> : null}
      {page === 'admin' ? <AdminPortal /> : null}
    </main>
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
  return (
    <section className="hero-section section-container" id="hero">
      <div className="hero-copy">
        {/* <p className="hero-eyebrow">Internal Training Request Portal</p> */}
        <h1>
          <span>Training & Certification</span>
          <span>Control Document</span>
        </h1>
        <p className="hero-lead">
          Aplikasi resmi perusahaan untuk pengajuan training dan sertifikasi internal maupun eksternal 
          yang dikelola oleh Departemen Learning & Academy.
          
        </p>
        <div className="hero-proof" aria-label="Keunggulan TCCD">
          {/* <span>SharePoint connected</span>
          <span>Power Apps ready</span>
          <span>Participant tracking</span> */}
        </div>
      </div>
      <TrainingRequestPreview userName={userName} canOpenAdminPortal={canOpenAdminPortal} />
    </section>
  )
}

function TrainingRequestPreview({
  userName,
  canOpenAdminPortal,
}: {
  userName: string
  canOpenAdminPortal: boolean
}) {
  const displayName = formatUserName(userName)

  return (
    <aside className="request-preview landing-dashboard" aria-label="Ringkasan portal TCCD">
      <div className="dashboard-glow" aria-hidden="true" />
      <div className="dashboard-topbar">
        <div className="dashboard-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="dashboard-status">
          <span className="status-pulse" />
          
        </span>
      </div>

      <motion.div
        className="dashboard-greeting"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div>
          <h2>
            {getTimeGreeting()}, {displayName}
          </h2>
        </div>
        <div className="greeting-avatar" aria-hidden="true">
          {getInitials(displayName)}
        </div>
      </motion.div>

      <div className="dashboard-resource-panel" aria-label="Navigasi resource TCCD">
        <motion.div
          className="hero-actions"
          aria-label="Aksi utama"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <a className="primary-button" href="#/request-form">
            Buat Pengajuan
          </a>
          <a className="secondary-button" href="#/requests">
            Lihat Data Pengajuan
          </a>
          {canOpenAdminPortal ? (
            <a className="admin-entry-button" href="#/admin">
              Portal Admin
            </a>
          ) : null}
        </motion.div>
        <p className="resource-panel-label">Quick access</p>
        <div className="resource-link-grid">
          {resourceLinks.map((link, index) => (
            <ResourceLinkButton key={link.title} link={link} index={index} />
          ))}
        </div>
      </div>
    </aside>
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
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.22 + index * 0.1, duration: 0.48, ease: 'easeOut' }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
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
        &rarr;
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
          description="Alur TCCD dibuat transparan agar requester dan Departemen Learning & Academy dapat melihat posisi pengajuan dengan jelas."
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
      initial={{ opacity: 0, y: 50, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ margin: "-40px" }}
      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="cta-copy">
        <h2>Butuh pelatihan atau sertifikasi untuk tim Anda?</h2>
        <p>
          
Ajukan melalui Form TCCD agar permintaan tercatat rapi dan dapat segera diproses oleh Departemen Learning & Academy.
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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{}}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
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
      viewport={{ amount: 0.22 }}
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
      viewport={{ amount: 0.3 }}
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
