import { lstatSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'

// The app used to be called Ledge. Its database was ledge.db (plus -wal and -shm files).
const LEGACY_DB = /^ledge\.db(?=$|-)/

function taken(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

// Renames without ever replacing something that is already there. Returns whether it moved.
function move(from: string, to: string): boolean {
  if (taken(to)) return false
  try {
    renameSync(from, to)
    return true
  } catch (error) {
    console.error(`[perch] could not move ${from}`, error)
    return false
  }
}

/**
 * Brings the data of an older Ledge install into Perch's folder. Runs before the database is opened.
 * Only acts when Ledge's folder exists and Perch has no database yet; nothing is deleted or overwritten,
 * and a failure is logged so the app still starts (with whatever could be moved).
 */
export function migrateLegacyData(newDir: string, legacyDir: string): void {
  try {
    if (!taken(legacyDir) || taken(join(newDir, 'perch.db'))) return
    if (!taken(newDir) && move(legacyDir, newDir)) {
      for (const suffix of ['', '-wal', '-shm']) move(join(newDir, `ledge.db${suffix}`), join(newDir, `perch.db${suffix}`))
      return
    }
    // Perch's folder already exists (Electron makes it early): move entries across one by one.
    mkdirSync(newDir, { recursive: true })
    for (const name of readdirSync(legacyDir)) {
      move(join(legacyDir, name), join(newDir, name.replace(LEGACY_DB, 'perch.db')))
    }
  } catch (error) {
    console.error('[perch] could not bring over data from Ledge', error)
  }
}
