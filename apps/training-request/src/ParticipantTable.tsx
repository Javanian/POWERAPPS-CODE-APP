import type { ChangeEvent } from 'react'
import type { EmployeeLookupData } from './employeeLookup'

export type ParticipantFormValues = {
  rowId: string
  personnelNumber: string
  nama: string
  division: string
  area: string
  status: string
  masaKerja: string
}

type ParticipantTableProps = {
  participants: ParticipantFormValues[]
  lookupData: EmployeeLookupData | null
  lookupStatus: 'loading' | 'ready' | 'error'
  lookupError: string | null
  isDisabled?: boolean
  onAddParticipant: () => void
  onRemoveParticipant: (rowId: string) => void
  onUpdateParticipant: (
    rowId: string,
    field: keyof Omit<ParticipantFormValues, 'rowId'>,
    value: string,
  ) => void
}

export function ParticipantTable({
  participants,
  lookupData,
  lookupStatus,
  lookupError,
  isDisabled,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant,
}: ParticipantTableProps) {
  return (
    <div className="participant-stage">
      <div className="participant-header">
        <div>
          <h2>Participant</h2>
          <p>
            Tambahkan peserta training. Personnel number akan dicocokkan ke file employee jika
            data lookup berhasil dimuat.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onAddParticipant} disabled={isDisabled}>
          Add Participant
        </button>
      </div>

      <div className={`lookup-status lookup-status-${lookupStatus}`}>
        {lookupStatus === 'loading' && 'Memuat employee lookup...'}
        {lookupStatus === 'ready' && 'Data karyawan Valid'}
        {lookupStatus === 'error' &&
          `${lookupError ?? 'Data karyawan belum bisa dimuat.'} Field tetap bisa diisi manual.`}
      </div>

      <div className="participant-table-wrap">
        <table className="participant-table">
          <thead>
            <tr>
              <th>Personnel Number</th>
              <th>Nama</th>
              <th>Division</th>
              <th>Area</th>
              <th>Status</th>
              <th>Masa Kerja</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => (
              <tr key={participant.rowId}>
                <td data-label="Personnel Number">
                  <input
                    value={participant.personnelNumber}
                    onChange={(event) =>
                      onUpdateParticipant(
                        participant.rowId,
                        'personnelNumber',
                        event.target.value,
                      )
                    }
                    placeholder="Personnel no"
                    disabled={isDisabled}
                    required
                  />
                </td>
                <td data-label="Nama">
                  <input
                    value={participant.nama}
                    onChange={handleParticipantChange(participant.rowId, 'nama', onUpdateParticipant)}
                    placeholder="Nama participant"
                    disabled={isDisabled}
                    required
                  />
                </td>
                <td data-label="Division">
                  <ComboInput
                    value={participant.division}
                    options={lookupData?.divisionOptions ?? []}
                    listId={`division-options-${participant.rowId}`}
                    placeholder="Pilih / isi division"
                    disabled={isDisabled}
                    onChange={(value) => onUpdateParticipant(participant.rowId, 'division', value)}
                  />
                </td>
                <td data-label="Area">
                  <ComboInput
                    value={participant.area}
                    options={lookupData?.areaOptions ?? []}
                    listId={`area-options-${participant.rowId}`}
                    placeholder="Pilih / isi area"
                    disabled={isDisabled}
                    onChange={(value) => onUpdateParticipant(participant.rowId, 'area', value)}
                  />
                </td>
                <td data-label="Status">
                  <ComboInput
                    value={participant.status}
                    options={lookupData?.statusOptions ?? []}
                    listId={`status-options-${participant.rowId}`}
                    placeholder="Pilih / isi status"
                    disabled={isDisabled}
                    onChange={(value) => onUpdateParticipant(participant.rowId, 'status', value)}
                  />
                </td>
                <td data-label="Masa Kerja">
                  <input
                    value={participant.masaKerja}
                    onChange={handleParticipantChange(
                      participant.rowId,
                      'masaKerja',
                      onUpdateParticipant,
                    )}
                    placeholder="Contoh: 3 tahun"
                    disabled={isDisabled}
                    required
                  />
                </td>
                <td data-label="Action">
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => onRemoveParticipant(participant.rowId)}
                    disabled={isDisabled || participants.length === 1}
                    aria-label={`Remove participant ${index + 1}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ComboInput({
  value,
  options,
  listId,
  placeholder,
  disabled,
  onChange,
}: {
  value: string
  options: string[]
  listId: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}

function handleParticipantChange(
  rowId: string,
  field: keyof Omit<ParticipantFormValues, 'rowId'>,
  onUpdateParticipant: ParticipantTableProps['onUpdateParticipant'],
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateParticipant(rowId, field, event.target.value)
  }
}
