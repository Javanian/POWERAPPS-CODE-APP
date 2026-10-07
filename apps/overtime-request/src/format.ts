const dateFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function formatDate(isoDate: string) {
  return isoDate ? dateFormat.format(parseDate(isoDate)) : '-'
}

export function formatMonth(month: string) {
  return monthFormat.format(parseDate(`${month}-01`))
}

export function dayParts(isoDate: string) {
  const date = parseDate(isoDate)
  return {
    day: String(date.getDate()),
    month: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(date),
  }
}

export function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
