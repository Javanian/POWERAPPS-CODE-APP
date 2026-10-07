// SALINAN VERBATIM form "Test Post 5R_ITEM" dari App.tsx versi AWAL project.
// Logika upload TIDAK diubah sedikit pun — fungsi yang dipanggil
// (create5RItemTestListItem / upload5RItemTestAttachment) juga masih sama
// dengan versi awal. Halaman ini untuk pembanding apple-to-apple.
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getPowerAppsErrorMessage, getPowerAppsOperationErrorDetail, withPowerAppsTimeout } from './powerAppsData'
import { create5RItemTestListItem, upload5RItemTestAttachment } from './uploadAttachment'

const maxUploadSizeBytes = 90 * 1024 * 1024

type FormMessage = {
  type: 'success' | 'error'
  text: string
}

function sanitizeSharePointFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[~"#%&*:<>?/\\{|}]/g, '_')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned && !/^\.+$/.test(cleaned) ? cleaned : 'upload.bin'
}

function getUploadValidationError(uploadFiles: Array<{ file: File; fileName: string }>) {
  const tooLargeFile = uploadFiles.find(({ file }) => file.size > maxUploadSizeBytes)

  if (!tooLargeFile) {
    return null
  }

  return `"${tooLargeFile.file.name}" melebihi batas 90 MB per file.`
}

export function OriginalTestFormPage({ onBack }: { onBack: () => void }) {
  const [testId5R, setTestId5R] = useState('')
  const [testAttachmentFile, setTestAttachmentFile] = useState<File | null>(null)
  const [isTestSubmitting, setIsTestSubmitting] = useState(false)
  const [testMessage, setTestMessage] = useState<FormMessage | null>(null)

  function handleTestAttachmentChange(e: ChangeEvent<HTMLInputElement>) {
    setTestAttachmentFile(e.target.files?.[0] ?? null)
  }

  async function handleTestSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isTestSubmitting) return
    setTestMessage(null)

    const trimmedId5R = testId5R.trim()

    if (!trimmedId5R) {
      setTestMessage({ type: 'error', text: 'ID5R wajib diisi.' })
      return
    }

    if (!testAttachmentFile) {
      setTestMessage({ type: 'error', text: 'Attachment wajib dipilih.' })
      return
    }

    const uploadFileName = sanitizeSharePointFileName(testAttachmentFile.name)
    const uploadValidationError = getUploadValidationError([{ file: testAttachmentFile, fileName: uploadFileName }])

    if (uploadValidationError) {
      setTestMessage({ type: 'error', text: uploadValidationError })
      return
    }

    setIsTestSubmitting(true)
    let createdId: number | undefined

    try {
      const result = await withPowerAppsTimeout(
        create5RItemTestListItem({
          ID5R: trimmedId5R,
        }),
      )

      console.info('5R_ITEM test - result:', result)

      if (!result.success) {
        throw new Error(`Gagal menyimpan 5R_ITEM: ${getPowerAppsOperationErrorDetail(result.error)}`)
      }

      createdId = result.data?.ID

      if (!createdId) {
        throw new Error('Item 5R_ITEM sudah dibuat, tapi response tidak mengembalikan ID item.')
      }

      setTestMessage({
        type: 'success',
        text: `5R_ITEM tersimpan dengan ID ${createdId}. Upload attachment: ${uploadFileName}`,
      })

      await withPowerAppsTimeout(
        upload5RItemTestAttachment({
          itemId: createdId,
          fileName: uploadFileName,
          file: testAttachmentFile,
        }),
        60000,
      )

      setTestMessage({
        type: 'success',
        text: `Test 5R_ITEM berhasil. ID item: ${createdId}. Attachment berhasil diupload.`,
      })
      setTestId5R('')
      setTestAttachmentFile(null)
    } catch (err) {
      const context = createdId
        ? `5R_ITEM sudah tersimpan dengan ID ${createdId}, tapi upload attachment gagal`
        : 'Gagal menyimpan test 5R_ITEM'
      setTestMessage({ type: 'error', text: getPowerAppsErrorMessage(err, context) })
    } finally {
      setIsTestSubmitting(false)
    }
  }

  return (
    <div className="audit-app">
      <header className="audit-header">
        <div className="audit-brand">
          <button type="button" className="btn-back" onClick={onBack} aria-label="Kembali ke halaman utama">
            <ArrowLeft size={20} />
          </button>
          <span className="audit-logo">T</span>
          <div>
            <h1>Test Post 5R_ITEM (form awal)</h1>
            <p>Salinan persis form test versi awal — logika upload tidak diubah</p>
          </div>
        </div>
      </header>

      <main className="audit-main">
        <form className="audit-form test-form" onSubmit={handleTestSubmit}>
          <div className="form-section">
            <div className="form-section-header">
              <span className="section-badge">T</span>
              <h2 className="form-section-title">Test Post 5R_ITEM</h2>
            </div>
            <p className="form-section-desc">
              Form kecil untuk test create item ke list 5R_ITEM dengan kolom ID5R dan satu attachment.
            </p>

            <div className="form-grid">
              <label className="form-field">
                <span>ID5R <strong>*</strong></span>
                <input
                  type="text"
                  value={testId5R}
                  onChange={(e) => setTestId5R(e.target.value)}
                  placeholder="Masukkan ID5R"
                  required
                />
              </label>

              <label className="form-field form-field-wide">
                <span>Attachment <strong>*</strong></span>
                <div className="file-upload-area">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleTestAttachmentChange}
                    id="test-5r-item-attachment"
                  />
                  <label htmlFor="test-5r-item-attachment" className="file-upload-label">
                    {testAttachmentFile ? (
                      <span className="file-selected">
                        {testAttachmentFile.name} ({(testAttachmentFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <>
                        <span>Klik untuk pilih attachment test 5R_ITEM</span>
                        <span className="upload-hint">PDF, DOC, XLS, JPG, PNG. Maks 90 MB.</span>
                      </>
                    )}
                  </label>
                </div>
              </label>
            </div>

            {testMessage ? (
              <div className={`form-message form-message-${testMessage.type}`}>
                {testMessage.text}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setTestId5R('')
                  setTestAttachmentFile(null)
                  setTestMessage(null)
                }}
                disabled={isTestSubmitting}
              >
                Reset Test
              </button>
              <button type="submit" className="btn-primary" disabled={isTestSubmitting}>
                {isTestSubmitting ? 'Menyimpan...' : 'Submit Test 5R_ITEM'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
