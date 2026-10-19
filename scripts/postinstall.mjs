import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(resolve(root, 'native/bin'), { recursive: true })

const swift = spawnSync(
  'swiftc',
  [
    '-swift-version',
    '5',
    '-target',
    `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos13.0`,
    '-O',
    '-framework',
    'AppKit',
    '-framework',
    'ApplicationServices',
    '-o',
    'native/bin/GestureHelper',
    'native/GestureHelper.swift'
  ],
  { cwd: root, stdio: 'inherit' }
)

if (swift.status !== 0) {
  process.exit(swift.status ?? 1)
}

const rebuild = spawnSync(
  'electron-rebuild',
  ['-f', '-w', 'node-pty,better-sqlite3'],
  { cwd: root, stdio: 'inherit' }
)

if (rebuild.status !== 0) {
  process.exit(rebuild.status ?? 1)
}
