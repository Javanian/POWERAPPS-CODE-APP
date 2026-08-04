import type { _5RNewAppsWrite } from './generated/models/_5RNewAppsModel'

export type WriteField = keyof Omit<_5RNewAppsWrite, 'ID'>

export type AuditItemDef = {
  id: string
  label: string
  scoreField: WriteField
  keteranganField: WriteField
  actionPlanField: WriteField
  /** Prefix nama file evidence, mis. Evidence_R2_KeteraturanArea */
  evidencePrefix: string
  /**
   * Internal name kolom Image (Thumbnail) fase "before" — hardcode, sudah
   * diverifikasi lewat SharePoint REST API. JANGAN diturunkan dari display name:
   * internal name membeku di nama asli sebelum kolom di-rename.
   */
  imageFieldInternalName: string
  /**
   * Display name kolom Image — dipakai sebagai `fieldName` di JSON thumbnail.
   * Hasil uji GetItems: nilai yang terbukti render memakai DISPLAY
   * name di properti ini, bukan internal name.
   */
  imageFieldDisplayName: string
  /** Internal name kolom foto After-Action (fase follow-up), diverifikasi via REST. */
  actionImageFieldInternalName: string
  /** Display name kolom foto After-Action — untuk fieldName JSON thumbnail. */
  actionImageFieldDisplayName: string
}

export type AuditCategoryDef = {
  key: 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
  name: string
  desc: string
  /** Warna kategori — mengikuti palet pilar 5R di landing page (warna logo). */
  color: string
  /** Warna teks di atas warna kategori (AA). */
  colorText: string
  /** Background chip skor. */
  tint: string
  items: AuditItemDef[]
}

export const SCORE_OPTIONS = ['0', '3', '5'] as const
export type ScoreOption = (typeof SCORE_OPTIONS)[number]

export type AuditItemState = {
  score: '' | ScoreOption
  keterangan: string
  actionPlan: string
  evidence: File | null
}

const allCategories: AuditCategoryDef[] = [
  {
    key: 'R1',
    name: 'Ringkas',
    desc: 'Pisahkan benda kerja yang diperlukan dan tidak diperlukan. Benda yang tidak diperlukan segera disingkirkan.',
    color: '#e03131',
    colorText: '#ffffff',
    tint: '#fdecec',
    items: [
      {
        id: 'r1-pemilahan-benda-kerja',
        label: 'Pemilahan Benda Kerja',
        scoreField: 'Ringkas_x002d_PemilahanBendaKerj',
        keteranganField: 'KeteranganRingkas_x002d_Pemilaha',
        actionPlanField: 'ActionPlanR1_x002d_PemilahanBend',
        evidencePrefix: 'Evidence_R1_PemilahanBendaKerja',
        imageFieldInternalName: 'FotoRingkas',
        imageFieldDisplayName: 'Evidence R1-Pemilahan Benda Kerja',
        actionImageFieldInternalName: 'AfterActionPlanR1_x002d_Pemilaha',
        actionImageFieldDisplayName: 'Evidence Action R1-Pemilahan Benda Kerja',
      },
    ],
  },
  {
    key: 'R2',
    name: 'Rapi',
    desc: 'Tata benda kerja pada tempatnya: identifikasi jelas, area teratur, penyimpanan sesuai kategori.',
    color: '#f08c00',
    colorText: '#ffffff',
    tint: '#fef3e6',
    items: [
      {
        id: 'r2-identifikasi-marking',
        label: 'Identifikasi/Marking Jelas',
        scoreField: 'Rapi_x002d_Identifikasi_x002f_Ma',
        keteranganField: 'KeteranganRapi_x002d_Identifikas',
        actionPlanField: 'ActionPlanR2_x002d_Identifikasi_',
        evidencePrefix: 'Evidence_R2_IdentifikasiMarking',
        imageFieldInternalName: 'FotoRapi1',
        imageFieldDisplayName: 'Evidence R2-Identifikasi/Marking Jelas',
        actionImageFieldInternalName: 'AfterActionPlanR2_x002d_Identifi',
        actionImageFieldDisplayName: 'Evidence Action R2-Identifikasi/Marking Jelas',
      },
      {
        id: 'r2-keteraturan-area',
        label: 'Keteraturan Area',
        scoreField: 'ScoreR2_x002d_KeteraturanArea',
        keteranganField: 'KeteranganR2_x002d_KeteraturanAr',
        actionPlanField: 'ActionPlanR2_x002d_KeteraturanAr',
        evidencePrefix: 'Evidence_R2_KeteraturanArea',
        imageFieldInternalName: 'FotoRapi2',
        imageFieldDisplayName: 'Evidence R2-Keteraturan Area',
        actionImageFieldInternalName: 'EvidenceActionR2_x002d_Keteratur',
        actionImageFieldDisplayName: 'Evidence Action R2-Keteraturan Area',
      },
      {
        id: 'r2-penyimpanan-sesuai-kategori',
        label: 'Penyimpanan Sesuai Kapasitas & Kegunaan',
        scoreField: 'ScoreR2_x002d_PenyimpananSesuaiK',
        keteranganField: 'KeteranganR2_x002d_',
        actionPlanField: 'ActionPlanR2_x002d_PenyimpananSe',
        evidencePrefix: 'Evidence_R2_PenyimpananSesuaiKapasitas',
        imageFieldInternalName: 'FotoRapi3',
        imageFieldDisplayName: 'Evidence R2-Penyimpanan Sesuai Kapasitas & Kegunaan',
        actionImageFieldInternalName: 'EvidenceActionR2_x002d_Penyimpan',
        actionImageFieldDisplayName: 'Evidence Action R2-Penyimpanan Sesuai Kapasitas & Kegunaan',
      },
    ],
  },
  {
    key: 'R3',
    name: 'Resik',
    desc: 'Jaga kebersihan area kerja, benda kerja, dan pastikan alat kebersihan tersedia.',
    color: '#f5c518',
    colorText: '#4a3b00',
    tint: '#fdf8e0',
    items: [
      {
        id: 'r3-kebersihan-area-kerja',
        label: 'Kebersihan Area Kerja',
        scoreField: 'ScoreR3_x002d_KebersihanAreaKerj',
        keteranganField: 'KeteranganR3_x002d_KebersihanAre',
        actionPlanField: 'ActionPlanR3_x002d_KebersihanAre',
        evidencePrefix: 'Evidence_R3_KebersihanAreaKerja',
        imageFieldInternalName: 'FotoResik',
        imageFieldDisplayName: 'Evidence R3-Kebersihan Area Kerja',
        actionImageFieldInternalName: 'EvidenceActionR3_x002d_Kebersiha',
        actionImageFieldDisplayName: 'Evidence Action R3-Kebersihan Area Kerja',
      },
      {
        id: 'r3-kebersihan-benda-kerja',
        label: 'Kebersihan Benda Kerja',
        scoreField: 'ScoreR3_x002d_KebersihanBendaKer',
        keteranganField: 'KeteranganR3_x002d_KebersihanBen',
        actionPlanField: 'ActionPlanR3_x002d_KebersihanBen',
        evidencePrefix: 'Evidence_R3_KebersihanBendaKerja',
        imageFieldInternalName: 'FotoResik2',
        imageFieldDisplayName: 'Evidence R3-Kebersihan Benda Kerja',
        actionImageFieldInternalName: 'EvidenceActionR3_x002d_Kebersiha0',
        actionImageFieldDisplayName: 'Evidence Action R3-Kebersihan Benda Kerja',
      },
      {
        id: 'r3-keberadaan-alat-kebersihan',
        label: 'Keberadaan Alat Kebersihan',
        scoreField: 'ScoreR3_x002d_KeberadaanAlatKebe',
        keteranganField: 'KeteranganR3_x002d_KeberadaanAla',
        actionPlanField: 'R3_x002d_KeberadaanAlatKebersiha',
        evidencePrefix: 'Evidence_R3_KeberadaanAlatKebersihan',
        imageFieldInternalName: 'FotoResik3',
        imageFieldDisplayName: 'Evidence R3-Keberadaan Alat Kebersihan',
        actionImageFieldInternalName: 'EvidenceActionR3_x002d_Keberadaa',
        actionImageFieldDisplayName: 'Evidence Action R3-Keberadaan Alat Kebersihan',
      },
    ],
  },
  {
    key: 'R4',
    name: 'Rawat',
    desc: 'Pertahankan kondisi Ringkas, Rapi, dan Resik melalui prosedur dan standarisasi.',
    color: '#1e7ec8',
    colorText: '#ffffff',
    tint: '#e8f3fb',
    items: [
      {
        id: 'r4-prosedur-standarisasi',
        label: 'Prosedur/Standar Tersedia',
        scoreField: 'ScoreR4_x002d_Prosedur_x002f_Sta',
        keteranganField: 'KeteranganR4_x002d_Prosedur_x002',
        actionPlanField: 'ActionPlanR4_x002d_Prosedur_x002',
        evidencePrefix: 'Evidence_R4_ProsedurStandar',
        imageFieldInternalName: 'FotoRawat',
        imageFieldDisplayName: 'Evidence R4-Prosedur/Standar Tersedia',
        actionImageFieldInternalName: 'EvidenceActionR4_x002d_Prosedur_',
        actionImageFieldDisplayName: 'Evidence Action R4-Prosedur/Standar Tersedia',
      },
    ],
  },
  {
    key: 'R5',
    name: 'Rajin',
    desc: 'Biasakan disiplin 5R dan dorong perbaikan berkelanjutan.',
    color: '#2f9e44',
    colorText: '#ffffff',
    tint: '#eaf6ec',
    items: [
      {
        id: 'r5-pemantapan-5r',
        label: 'Pemantapan 5R',
        scoreField: 'ScoreR5_x002d_Pemantapan5R',
        keteranganField: 'KeteranganR5_x002d_Pemantapan5R',
        actionPlanField: 'ActionPlanR5_x002d_Pemantapan5R',
        evidencePrefix: 'Evidence_R5_Pemantapan5R',
        imageFieldInternalName: 'FotoRajin1',
        imageFieldDisplayName: 'Evidence R5-Pemantapan 5R',
        actionImageFieldInternalName: 'EvidenceActionR5_x002d_Pemantapa',
        actionImageFieldDisplayName: 'Evidence Action R5-Pemantapan 5R',
      },
      {
        id: 'r5-5r-improvement',
        label: '5R Improvement',
        scoreField: 'ScoreR5_x002d_5RImprovement',
        keteranganField: 'KeteranganR5_x002d_5RImprovement',
        actionPlanField: 'ActionPlanR5_x002d_5RImprovement',
        evidencePrefix: 'Evidence_R5_5RImprovement',
        imageFieldInternalName: 'FotoRajin2',
        imageFieldDisplayName: 'Evidence R5-5R Improvement',
        actionImageFieldInternalName: 'EvidenceActionR5_x002d_5RImprove',
        actionImageFieldDisplayName: 'Evidence Action R5-5R Improvement',
      },
    ],
  },
]

/**
 * MODE TEST: isi dengan key kategori yang ditampilkan (mis. ['R1']) untuk
 * menyembunyikan sisanya. Set ke null untuk menampilkan SEMUA kategori R1–R5.
 * Total score, star rating, dan validasi submit otomatis mengikuti kategori
 * yang tampil.
 */
// MODE TEST: isi mis. ['R1'] untuk menyembunyikan kategori lain; null = semua.
// `as` cast supaya TS tidak mempersempit ke tipe literal saat diisi null.
const visibleCategoryKeys = null as Array<AuditCategoryDef['key']> | null

export const AUDIT_CATEGORIES: AuditCategoryDef[] =
  visibleCategoryKeys === null
    ? allCategories
    : allCategories.filter((category) => visibleCategoryKeys.includes(category.key))

export const ALL_AUDIT_ITEMS = AUDIT_CATEGORIES.flatMap((category) => category.items)

export const MAX_TOTAL_SCORE = ALL_AUDIT_ITEMS.length * 5

export function createInitialAuditState(): Record<string, AuditItemState> {
  const state: Record<string, AuditItemState> = {}

  for (const item of ALL_AUDIT_ITEMS) {
    state[item.id] = { score: '', keterangan: '', actionPlan: '', evidence: null }
  }

  return state
}
