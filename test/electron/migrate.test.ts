import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { migrateLegacyData } from '../../electron/migrate'
import { openDatabase, readSettings, writeSettings } from '../../electron/db'
import { tempDir } from '../helpers/tmp'

afterEach(() => {
  vi.restoreAllMocks()
})

/** A layout like ~/Library/Application Support with Perch and Ledge folders as siblings. */
function support() {
  const root = tempDir('perch-migrate-')
  return { root, perch: join(root, 'Perch'), ledge: join(root, 'Ledge') }
}

const put = (dir: string, name: string, text: string) => {
  mkdirSync(join(dir, name, '..'), { recursive: true })
  writeFileSync(join(dir, name), text)
}
const read = (dir: string, name: string) => readFileSync(join(dir, name), 'utf8')

describe('migrateLegacyData', () => {
  it('does nothing on a fresh install', () => {
    const { perch, ledge } = support()
    migrateLegacyData(perch, ledge)
    expect(existsSync(perch)).toBe(false)
    expect(existsSync(ledge)).toBe(false)
  })

  it('moves the whole Ledge folder to Perch and renames the database files', () => {
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'db')
    put(ledge, 'ledge.db-wal', 'wal')
    put(ledge, 'ledge.db-shm', 'shm')
    put(ledge, 'notes/one.md', 'my note')
    put(ledge, 'clips/img.png', 'png')
    migrateLegacyData(perch, ledge)
    expect(existsSync(ledge)).toBe(false)
    expect(readdirSync(perch).sort()).toEqual(['clips', 'notes', 'perch.db', 'perch.db-shm', 'perch.db-wal'])
    expect(read(perch, 'perch.db')).toBe('db')
    expect(read(perch, 'perch.db-wal')).toBe('wal')
    expect(read(perch, 'perch.db-shm')).toBe('shm')
    expect(read(perch, 'notes/one.md')).toBe('my note')
  })

  it('works when Ledge has only a database, with no -wal or -shm file', () => {
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'db')
    migrateLegacyData(perch, ledge)
    expect(readdirSync(perch)).toEqual(['perch.db'])
  })

  it('leaves everything alone when Perch already has a database', () => {
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'old')
    put(ledge, 'notes/old.md', 'old')
    put(perch, 'perch.db', 'new')
    migrateLegacyData(perch, ledge)
    expect(read(perch, 'perch.db')).toBe('new')
    expect(readdirSync(perch)).toEqual(['perch.db'])
    expect(read(ledge, 'ledge.db')).toBe('old')
    expect(read(ledge, 'notes/old.md')).toBe('old')
  })

  it('fills in a Perch folder that exists without a database, without overwriting anything', () => {
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'db')
    put(ledge, 'ledge.db-wal', 'wal')
    put(ledge, 'notes/one.md', 'legacy note')
    put(ledge, 'Preferences', 'legacy prefs')
    put(perch, 'Preferences', 'new prefs')
    symlinkSync('nowhere', join(ledge, 'SingletonLock'))
    symlinkSync('elsewhere', join(perch, 'SingletonLock')) // dangling, but still "there"
    migrateLegacyData(perch, ledge)
    expect(readdirSync(perch).sort()).toEqual(['Preferences', 'SingletonLock', 'notes', 'perch.db', 'perch.db-wal'])
    expect(read(perch, 'perch.db')).toBe('db')
    expect(read(perch, 'notes/one.md')).toBe('legacy note')
    expect(read(perch, 'Preferences')).toBe('new prefs')
    // What could not move stays behind, untouched.
    expect(read(ledge, 'Preferences')).toBe('legacy prefs')
    expect(readdirSync(ledge).sort()).toEqual(['Preferences', 'SingletonLock'])
  })

  it('is idempotent', () => {
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'db')
    put(ledge, 'notes/one.md', 'note')
    migrateLegacyData(perch, ledge)
    put(perch, 'notes/two.md', 'written after the first run')
    migrateLegacyData(perch, ledge)
    expect(readdirSync(perch).sort()).toEqual(['notes', 'perch.db'])
    expect(readdirSync(join(perch, 'notes')).sort()).toEqual(['one.md', 'two.md'])
    expect(existsSync(ledge)).toBe(false)
  })

  it('keeps going and logs when an entry cannot be moved', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { perch, ledge } = support()
    put(ledge, 'ledge.db', 'db')
    put(ledge, 'notes/one.md', 'note')
    mkdirSync(perch)
    chmodSync(perch, 0o500) // Perch's folder cannot be written to
    try {
      migrateLegacyData(perch, ledge)
    } finally {
      chmodSync(perch, 0o700)
    }
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not move'), expect.anything())
    // Nothing was lost: the data is still in Ledge's folder.
    expect(read(ledge, 'ledge.db')).toBe('db')
    expect(read(ledge, 'notes/one.md')).toBe('note')
    // And once the problem is gone, the next launch finishes the job.
    migrateLegacyData(perch, ledge)
    expect(read(perch, 'perch.db')).toBe('db')
    expect(read(perch, 'notes/one.md')).toBe('note')
  })

  it('logs and returns when neither folder can be used at all', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const root = tempDir('perch-migrate-')
    const ledge = join(root, 'Ledge')
    put(ledge, 'ledge.db', 'db')
    chmodSync(root, 0o500) // nothing can be created or renamed next to Ledge
    try {
      expect(() => migrateLegacyData(join(root, 'Perch'), ledge)).not.toThrow()
    } finally {
      chmodSync(root, 0o700)
    }
    expect(error).toHaveBeenCalledWith('[perch] could not bring over data from Ledge', expect.anything())
    expect(read(ledge, 'ledge.db')).toBe('db')
  })

  it('the migrated database opens with its settings intact', () => {
    const { perch, ledge } = support()
    const made = tempDir('perch-migrate-')
    const db = openDatabase(made)
    writeSettings(db, { presetId: 'codex', customCommand: '', cwd: '/work', toolRatio: 0.3, clipRatio: 0.2, filesRatio: 0.2, heightRatio: 0.6, showTrayIcon: false })
    db.close() // closing checkpoints the write-ahead log into perch.db
    mkdirSync(ledge)
    writeFileSync(join(ledge, 'ledge.db'), readFileSync(join(made, 'perch.db')))
    migrateLegacyData(perch, ledge)
    expect(readSettings(openDatabase(perch), '/x')).toMatchObject({ presetId: 'codex', cwd: '/work', showTrayIcon: false })
  })
})
