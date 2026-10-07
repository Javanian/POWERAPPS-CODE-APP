type StatusFilterOption = {
  label: string
  tone: string
}

type StatusFilterBarProps = {
  options: StatusFilterOption[]
  counts: Record<string, number>
  total: number
  activeStatus: string | null
  onChange: (status: string | null) => void
}

// Compact status filter: one chip per status plus "Semua", in place of large summary cards.
export function StatusFilterBar({ options, counts, total, activeStatus, onChange }: StatusFilterBarProps) {
  return (
    <div className="status-filter-bar" role="group" aria-label="Filter status">
      <button
        type="button"
        className={`status-chip ${activeStatus === null ? 'status-chip-active' : ''}`}
        aria-pressed={activeStatus === null}
        onClick={() => onChange(null)}
      >
        Semua
        <span className="status-chip-count">{total}</span>
      </button>
      {options.map((option) => {
        const isActive = activeStatus === option.label
        const count = counts[option.label] ?? 0

        return (
          <button
            key={option.label}
            type="button"
            className={`status-chip ${isActive ? 'status-chip-active' : ''} ${count === 0 ? 'status-chip-empty' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? null : option.label)}
          >
            <span className={`status-dot status-dot-${option.tone}`} aria-hidden="true" />
            {option.label}
            <span className="status-chip-count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
