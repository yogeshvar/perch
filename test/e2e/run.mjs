// `npm run test:e2e`: build the UI, then drive it in a real Electron window with real mouse input.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const bin = (name) => resolve(root, 'node_modules/.bin', name)

console.log('Building the app…')
const build = spawnSync(bin('electron-vite'), ['build'], { cwd: root, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status ?? 1)

console.log('\nRunning end-to-end checks in Electron…')
const run = spawnSync(bin('electron'), [resolve(root, 'test/e2e/electron-main.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
})
process.exit(run.status ?? 1)
