import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ParticipantTable } from './ParticipantTable'
import type { ParticipantFormValues } from './ParticipantTable'
import { TCCDPARTICIPANTSService, TCCDService } from './generated'
import type { TCCDPARTICIPANTSWrite } from './generated/models/TCCDPARTICIPANTSModel'
import type { TCCDWrite } from './generated/models/TCCDModel'
import {
  findEmployeeByPersonnelNumber,
  loadEmployeeLookup,
  type EmployeeLookupData,
} from './employeeLookup'
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from './powerAppsData'

type RequestFormValues = {
  courseTitle: string
  planningDate: string
  requestType: 'training' | 'certification'
  justification: string
  objective: string
  participantCount: string
  learningImplement: 'internal' | 'eksternal'
  note: string
}

type FormStage = 'request' | 'participant'
type LookupStatus = 'loading' | 'ready' | 'error'

const initialValues: RequestFormValues = {
  courseTitle: '',
  planningDate: '',
  requestType: 'training',
  justification: '',
  objective: '',
  participantCount: '',
  learningImplement: 'internal',
  note: '',
}

export function TccdRequestForm() {
  const [values, setValues] = useState<RequestFormValues>(initialValues)
  const [stage, setStage] = useState<FormStage>('request')
  const [participants, setParticipants] = useState<ParticipantFormValues[]>([
    createEmptyParticipant(),
  ])
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookupData | null>(null)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('loading')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)
  const [, setDebugPayload] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadEmployeeLookup()
      .then((lookupData) => {
        if (cancelled) {
          return
        }

        setEmployeeLookup(lookupData)
        setLookupStatus('ready')
        setLookupError(null)
      })
      .catch((caughtError: unknown) => {
        if (cancelled) {
          return
        }

        setLookupStatus('error')
        setLookupError(caughtError instanceof Error ? caughtError.message : 'Employee lookup gagal dimuat.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const requestErrors = useMemo(() => validateRequestForm(values), [values])
  const participantErrors = useMemo(() => validateParticipants(participants), [participants])
  const isSubmitDisabled = isSubmitting || requestErrors.length > 0 || participantErrors.length > 0

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (requestErrors.length > 0) {
      setError(requestErrors[0])
      return
    }

    setParticipants((currentParticipants) =>
      resizeParticipants(currentParticipants, parseParticipantCount(values.participantCount)),
    )
    setStage('participant')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (requestErrors.length > 0) {
      setStage('request')
      setError(requestErrors[0])
      return
    }

    if (participantErrors.length > 0) {
      setError(participantErrors[0])
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('Membuat data TCCD...')
    setDebugPayload(null)

    try {
      const tccdPayload = buildTccdPayload(values, participants.length)
      setDebugPayload({
        step: 'create TCCD',
        list: 'TCCD',
        payload: tccdPayload,
      })
      const createResult = await withPowerAppsTimeout(
        TCCDService.create(tccdPayload),
      )

      if (!createResult.success) {
        throw new Error(
          createResult.error
            ? `Gagal membuat request TCCD: ${typeof createResult.error === 'string' ? createResult.error : JSON.stringify(createResult.error)}`
            : 'Gagal membuat request TCCD. Silakan coba lagi.',
        )
      }

      setSubmitStatus('Generate TCCD_NO dari ID SharePoint...')
      const createdId = createResult.data?.ID ?? (await getLatestSharePointId())
      const tccdNo = generateTccdNo(createdId)

      setSubmitStatus(`Menyimpan TCCD_NO ${tccdNo} ke request...`)
      const updateResult = await withPowerAppsTimeout(
        TCCDService.update(String(createdId), {
          TCCD_NO: tccdNo,
          IDROW: createdId,
        }),
      )

      if (!updateResult.success) {
        throw new Error(
          updateResult.error
            ? `Gagal menyimpan TCCD_NO: ${typeof updateResult.error === 'string' ? updateResult.error : JSON.stringify(updateResult.error)}`
            : 'Gagal menyimpan TCCD_NO. Silakan coba lagi.',
        )
      }

      for (const [index, participant] of participants.entries()) {
        const currentIndex = index + 1
        const participantPayload = buildParticipantPayload(participant, tccdNo)

        setSubmitStatus(`Menyimpan participant ${currentIndex} dari ${participants.length} dengan ${tccdNo}...`)
        setDebugPayload({
          step: `create participant ${currentIndex} of ${participants.length}`,
          list: 'TCCD PARTICIPANTS',
          payload: participantPayload,
        })

        console.info('TCCD PARTICIPANTS create payload', participantPayload)

        try {
          const participantCreateResult = await withPowerAppsTimeout(
            TCCDPARTICIPANTSService.create(participantPayload),
            20000,
          )

          if (!participantCreateResult.success) {
            throw new Error(
              participantCreateResult.error
                ? `Gagal menyimpan participant: ${typeof participantCreateResult.error === 'string' ? participantCreateResult.error : JSON.stringify(participantCreateResult.error)}`
                : 'Gagal menyimpan participant. Silakan coba lagi.',
            )
          }

          console.info('TCCD PARTICIPANTS create result', participantCreateResult)
        } catch (caughtError) {
          const participantLabel =
            participant.nama.trim() || participant.personnelNumber.trim() || `row ${currentIndex}`
          const reason = getPowerAppsErrorMessage(caughtError, 'Participant belum bisa dikirim')

          throw new Error(`Participant ${currentIndex} (${participantLabel}) gagal disubmit. ${reason}`)
        }
      }

      setSubmitStatus('Submit selesai. Membuka data request...')
      setValues(initialValues)
      setParticipants([createEmptyParticipant()])
      setStage('request')
      setMessage(`Request training berhasil dikirim dengan nomor ${tccdNo}.`)
      window.location.hash = '#/requests'
    } catch (caughtError) {
      setError(getPowerAppsErrorMessage(caughtError, 'Request training belum bisa dikirim'))
    } finally {
      setIsSubmitting(false)
      setSubmitStatus(null)
    }
  }

  function updateField(field: keyof RequestFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function addParticipant() {
    setParticipants((currentParticipants) => [...currentParticipants, createEmptyParticipant()])
  }

  function removeParticipant(rowId: string) {
    setParticipants((currentParticipants) =>
      currentParticipants.length === 1
        ? currentParticipants
        : currentParticipants.filter((participant) => participant.rowId !== rowId),
    )
  }

  function updateParticipant(
    rowId: string,
    field: keyof Omit<ParticipantFormValues, 'rowId'>,
    value: string,
  ) {
    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) => {
        if (participant.rowId !== rowId) {
          return participant
        }

        if (field !== 'personnelNumber') {
          return {
            ...participant,
            [field]: value,
          }
        }

        const matchedEmployee = findEmployeeByPersonnelNumber(employeeLookup, value)

        if (matchedEmployee) {
          console.info('Employee lookup matched participant', {
            personnelNumber: value,
            nama: matchedEmployee.nama,
            division: matchedEmployee.division,
            area: matchedEmployee.area,
            status: matchedEmployee.status,
            masaKerja: matchedEmployee.masaKerja,
            jobTitle: matchedEmployee.jobTitle,
          })
        } else if (value.trim()) {
          console.info('Employee lookup not found. Clearing participant lookup fields.', {
            personnelNumber: value,
            lookupLoaded: Boolean(employeeLookup),
          })
        }

        return {
          ...participant,
          personnelNumber: value,
          nama: matchedEmployee?.nama ?? '',
          division: matchedEmployee?.division ?? '',
          area: matchedEmployee?.area ?? '',
          status: matchedEmployee?.status ?? '',
          masaKerja: matchedEmployee?.masaKerja ?? '',
        }
      }),
    )
  }

  return (
    <section className="form-page section-container">
      <div className="page-title-block">
        <h1>Form Pengajuan Training</h1>
        <p>
          Isi kebutuhan training lalu lanjutkan ke pengisian peserta sebelum Submit.
        </p>
      </div>

      <div className="stage-progress" aria-label="Form progress">
        <div className={`stage-pill ${stage === 'request' ? 'stage-pill-active' : ''}`}>
          <span>1</span>
          Training request
        </div>
        <div className={`stage-pill ${stage === 'participant' ? 'stage-pill-active' : ''}`}>
          <span>2</span>
          Participant
        </div>
      </div>

      {stage === 'request' ? (
        <form className="request-form" onSubmit={handleContinue}>
          <div className="form-grid">
            <FormField label="Course Title" required>
              <input
                value={values.courseTitle}
                onChange={(event) => updateField('courseTitle', event.target.value)}
                placeholder="Contoh: Safety Leadership"
                required
              />
            </FormField>

            <FormField label="Planning Date" required>
              <input
                type="date"
                value={values.planningDate}
                onChange={(event) => updateField('planningDate', event.target.value)}
                required
              />
            </FormField>

            <FormField label="Type of Request" required>
              <select
                value={values.requestType}
                onChange={(event) => updateField('requestType', event.target.value)}
                required
              >
                <option value="training">Training</option>
                <option value="certification">Certification</option>
              </select>
            </FormField>

            <FormField label="Number of Participants">
              <input
                type="number"
                min="1"
                value={values.participantCount}
                onChange={(event) => updateField('participantCount', event.target.value)}
                placeholder="Contoh: 12"
              />
            </FormField>

            <FormField label="Learning Implementation" required>
              <select
                value={values.learningImplement}
                onChange={(event) => updateField('learningImplement', event.target.value)}
                required
              >
                <option value="internal">Internal</option>
                <option value="eksternal">External</option>
              </select>
            </FormField>

            <FormField label="Justification" wide required>
              <textarea
                value={values.justification}
                onChange={(event) => updateField('justification', event.target.value)}
                placeholder="Alasan kebutuhan training"
                rows={4}
                required
              />
            </FormField>

            <FormField label="Objective" wide required>
              <textarea
                value={values.objective}
                onChange={(event) => updateField('objective', event.target.value)}
                placeholder="Tujuan training yang ingin dicapai"
                rows={4}
                required
              />
            </FormField>

            <FormField label="Note" wide>
              <textarea
                value={values.note}
                onChange={(event) => updateField('note', event.target.value)}
                placeholder="Informasi tambahan (opsional)"
                rows={3}
              />
            </FormField>
          </div>

          {(message || error) && (
            <div className={`form-alert ${error ? 'form-alert-error' : 'form-alert-success'}`}>
              {error ?? message}
            </div>
          )}

          <div className="form-actions">
            <a className="secondary-button" href="#/requests">
              Lihat Data Pengajuan
            </a>
            <button className="primary-button" type="submit" disabled={requestErrors.length > 0}>
              Pengisian Peserta
            </button>
          </div>
        </form>
      ) : (
        <form className="request-form" onSubmit={handleSubmit}>
          <ParticipantTable
            participants={participants}
            lookupData={employeeLookup}
            lookupStatus={lookupStatus}
            lookupError={lookupError}
            isDisabled={isSubmitting}
            onAddParticipant={addParticipant}
            onRemoveParticipant={removeParticipant}
            onUpdateParticipant={updateParticipant}
          />

          {isSubmitting && submitStatus && (
            <div className="submit-progress" role="status" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <span>{submitStatus}</span>
            </div>
          )}

          {(message || error) && (
            <div className={`form-alert ${error ? 'form-alert-error' : 'form-alert-success'}`}>
              {error ?? message}
            </div>
          )}

          <div className="form-actions form-actions-between">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setStage('request')}
              disabled={isSubmitting}
            >
              Kembali
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Mengirim...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function FormField({
  label,
  children,
  required,
  wide,
}: {
  label: string
  children: ReactNode
  required?: boolean
  wide?: boolean
}) {
  return (
    <label className={`form-field ${wide ? 'form-field-wide' : ''}`}>
      <span>
        {label}
        {required ? <strong> *</strong> : null}
      </span>
      {children}
    </label>
  )
}

function buildTccdPayload(values: RequestFormValues, participantCount: number): Omit<TCCDWrite, 'ID'> {
  return {
    Title: values.courseTitle.trim(),
    COURSE_TITLE: values.courseTitle.trim(),
    PLANNING_DATE: values.planningDate,
    TYPE_OF_REQUEST: values.requestType,
    JUSTIFICATION: values.justification.trim(),
    OBJECTIVE: values.objective.trim(),
    NUMBER_PARTICIPANT: participantCount,
    PROVIDER: values.learningImplement,
    TYPE_OF_LEARNING: values.requestType,
    NOTE: values.note.trim(),
    REQUEST_STATUS: 'Waiting Assign',
  }
}

function buildParticipantPayload(
  participant: ParticipantFormValues,
  tccdNo: string,
): Omit<TCCDPARTICIPANTSWrite, 'ID'> {
  return {
    TCCD_NO: toText(tccdNo),
    SN: toText(participant.personnelNumber),
    NAME: toText(participant.nama),
    DIVISION: toText(participant.division),
    SITE_AREA: toText(participant.area),
    EMPLOYEE_STATUS: toText(participant.status),
    EMAIL: '',
    SERVICE_YEAR: toText(participant.masaKerja),
  }
}

function toText(value: unknown) {
  return String(value ?? '').trim()
}

async function getLatestSharePointId() {
  const result = await withPowerAppsTimeout(
    TCCDService.getAll({
      select: ['ID'],
      top: 1,
      orderBy: ['ID desc'],
    }),
  )
  const latestId = result.data?.[0]?.ID

  if (!latestId) {
    throw new Error('ID SharePoint terbaru tidak ditemukan untuk generate TCCD_NO.')
  }

  return latestId
}

function generateTccdNo(sequenceNumber: number) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const sequence = String(sequenceNumber).padStart(4, '0')

  return `TCCD-${year}-${month}-${sequence}`
}

function createEmptyParticipant(): ParticipantFormValues {
  return {
    rowId: createRowId(),
    personnelNumber: '',
    nama: '',
    division: '',
    area: '',
    status: '',
    masaKerja: '',
  }
}

function createRowId() {
  return crypto.randomUUID?.() ?? `participant-${Date.now()}-${Math.random()}`
}

function resizeParticipants(participants: ParticipantFormValues[], targetCount: number) {
  const safeTargetCount = Math.max(1, targetCount)

  if (participants.length === safeTargetCount) {
    return participants
  }

  if (participants.length > safeTargetCount) {
    return participants.slice(0, safeTargetCount)
  }

  return [
    ...participants,
    ...Array.from({ length: safeTargetCount - participants.length }, createEmptyParticipant),
  ]
}

function parseParticipantCount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function validateRequestForm(values: RequestFormValues) {
  const errors: string[] = []

  if (!values.courseTitle.trim()) {
    errors.push('Course Title wajib diisi.')
  }

  if (!values.planningDate) {
    errors.push('Planning Date wajib diisi.')
  }

  if (!values.requestType) {
    errors.push('Type of Request wajib dipilih.')
  }

  if (!values.justification.trim()) {
    errors.push('Justification wajib diisi.')
  }

  if (!values.objective.trim()) {
    errors.push('Objective wajib diisi.')
  }

  if (!values.learningImplement) {
    errors.push('Learning Implement wajib dipilih.')
  }

  return errors
}

function validateParticipants(participants: ParticipantFormValues[]) {
  const errors: string[] = []

  if (participants.length === 0) {
    errors.push('Minimal 1 participant wajib ditambahkan.')
    return errors
  }

  participants.forEach((participant, index) => {
    const rowNumber = index + 1

    if (!participant.personnelNumber.trim()) {
      errors.push(`Personnel Number participant ${rowNumber} wajib diisi.`)
    }

    if (!participant.nama.trim()) {
      errors.push(`Nama participant ${rowNumber} wajib diisi.`)
    }

    if (!participant.division.trim()) {
      errors.push(`Division participant ${rowNumber} wajib diisi.`)
    }

    if (!participant.area.trim()) {
      errors.push(`Area participant ${rowNumber} wajib diisi.`)
    }

    if (!participant.status.trim()) {
      errors.push(`Status participant ${rowNumber} wajib diisi.`)
    }

    if (!participant.masaKerja.trim()) {
      errors.push(`Masa Kerja participant ${rowNumber} wajib diisi.`)
    }
  })

  return errors
}
