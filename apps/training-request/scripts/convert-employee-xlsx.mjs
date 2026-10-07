import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import xlsx from 'xlsx'

const defaultInputPath = path.resolve('src/excel/employee.xlsx')
const defaultOutputPath = path.resolve('src/excel/employee.json')

const inputPath = path.resolve(process.argv[2] ?? defaultInputPath)
const outputPath = path.resolve(process.argv[3] ?? defaultOutputPath)

const fieldAliases = {
  personnel_number: ['personnel_number', 'personnel number', 'personnel no', 'personnel_no', 'sn', 'nik', 'nrp'],
  nama: ['complete name', 'complete_name', 'nama', 'name', 'employee name', 'employee_name'],
  division: ['division', 'divisi'],
  area: ['subarea', 'sub area', 'area', 'site_area', 'site area', 'site'],
  status: ['status', 'employee_status', 'employee status'],
  masa_kerja: ['masa_kerja', 'masa kerja', 'service_year', 'service year', 'years of service'],
  jobtitle: ['jobtitle', 'job title', 'job', 'position', 'jabatan'],
}

if (!fs.existsSync(inputPath)) {
  console.error(`Employee workbook not found: ${inputPath}`)
  process.exit(1)
}

const workbook = xlsx.readFile(inputPath, {
  cellDates: true,
  raw: false,
})
const sheetName = workbook.SheetNames[0]

if (!sheetName) {
  console.error('Workbook does not contain any sheet.')
  process.exit(1)
}

const sheet = workbook.Sheets[sheetName]
const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: '',
  raw: false,
})

const employees = rows
  .map((row) => mapEmployeeRow(row))
  .filter((employee) => Object.values(employee).some(Boolean))

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(employees, null, 2)}\n`, 'utf8')

const rowsWithoutPersonnelNumber = employees.filter((employee) => !employee.personnel_number).length

console.info(`Converted ${employees.length} employee rows from "${sheetName}".`)
console.info(`Output: ${outputPath}`)

if (rowsWithoutPersonnelNumber > 0) {
  console.warn(`${rowsWithoutPersonnelNumber} rows do not have personnel_number.`)
}

function mapEmployeeRow(row) {
  return {
    personnel_number: getValue(row, fieldAliases.personnel_number),
    nama: getValue(row, fieldAliases.nama),
    division: getValue(row, fieldAliases.division),
    area: getValue(row, fieldAliases.area),
    status: getValue(row, fieldAliases.status),
    masa_kerja: getValue(row, fieldAliases.masa_kerja),
    jobtitle: getValue(row, fieldAliases.jobtitle),
  }
}

function getValue(row, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      return formatValue(value)
    }
  }

  return ''
}

function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function formatValue(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value ?? '').trim()
}
