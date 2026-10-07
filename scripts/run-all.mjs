// Runs an npm script in every application under apps/, e.g. `node scripts/run-all.mjs build`.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const script = process.argv[2]
if (!script) {
  console.error('Usage: node scripts/run-all.mjs <npm-script>')
  process.exit(1)
}

const appsDirectory = path.resolve(import.meta.dirname, '..', 'apps')
const apps = fs
  .readdirSync(appsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(appsDirectory, entry.name, 'package.json')))
  .map((entry) => entry.name)

const failed = []
for (const app of apps) {
  console.info(`\n> ${app}: npm run ${script}`)
  const args = script === 'ci' ? ['ci'] : ['run', script, '--if-present']
  const result = spawnSync('npm', args, { cwd: path.join(appsDirectory, app), stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) failed.push(app)
}

if (failed.length > 0) {
  console.error(`\nnpm ${script} failed in: ${failed.join(', ')}`)
  process.exit(1)
}
