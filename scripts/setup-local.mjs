import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const appDirectory = process.cwd()

function copyIfMissing(source, destination) {
  const sourcePath = path.join(appDirectory, source)
  const destinationPath = path.join(appDirectory, destination)
  if (fs.existsSync(destinationPath)) return
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  fs.copyFileSync(sourcePath, destinationPath)
  console.info(`Created ${destination} from the example. Configure it before connecting to Power Apps.`)
}

copyIfMissing('power.config.example.json', 'power.config.json')
copyIfMissing('config/dataSourcesInfo.example.ts', '.power/schemas/appschemas/dataSourcesInfo.ts')

if (fs.existsSync(path.join(appDirectory, 'src/excel/employee.example.json'))) {
  copyIfMissing('src/excel/employee.example.json', 'src/excel/employee.json')
}
