import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { nativeImage } from 'electron'
import type Database from 'better-sqlite3'
import type { FileInfo, ShelfFile } from '../src/shared/types'
import type { FileRow } from './db'
import { emit } from './bus'
import { trayPng } from './icon'

const MAX_FILES = 200
let database: Database.Database | null = null

export function startFiles(db: Database.Database): void {
  database = db
}

export function listFiles(): ShelfFile[] {
  if (!database) return []
  const rows = database.prepare('SELECT * FROM files ORDER BY added_at DESC').all() as FileRow[]
  return rows.map(toFile)
}

export function filePath(id: string): string | null {
  const row = database?.prepare('SELECT path FROM files WHERE id = ?').get(id) as
    | { path: string }
    | undefined
  return row?.path ?? null
}

// Files are stored as references; nothing is copied or deleted on disk.
export function addFiles(paths: string[]): ShelfFile[] {
  if (!database) return []
  const insert = database.prepare(
    'INSERT OR IGNORE INTO files (id, path, name, added_at) VALUES (?, ?, ?, ?)'
  )
  const now = Date.now()
  paths.slice(0, MAX_FILES).forEach((path, index) => {
    if (!path.startsWith('/') || !existsSync(path)) return
    insert.run(randomUUID(), path, basename(path), now - index)
  })
  return publish()
}

export function removeFile(id: string): ShelfFile[] {
  database?.prepare('DELETE FROM files WHERE id = ?').run(id)
  return publish()
}

export function clearFiles(): ShelfFile[] {
  database?.prepare('DELETE FROM files').run()
  return publish()
}

function publish(): ShelfFile[] {
  const files = listFiles()
  emit('files:changed', files)
  return files
}

function toFile(row: FileRow): ShelfFile {
  return { id: row.id, path: row.path, name: row.name, addedAt: row.added_at }
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
const MAX_THUMB_BYTES = 15 * 1024 * 1024

// Plain fs + image decoding only; deliberately avoids app.getFileIcon (suspected in a main-process crash).
export function fileInfo(id: string): FileInfo {
  const path = filePath(id)
  if (!path) return { kind: 'missing', ext: '', thumb: null }
  try {
    const stat = statSync(path)
    if (stat.isDirectory()) return { kind: 'folder', ext: '', thumb: null }
    const ext = extname(path).toLowerCase()
    let thumb: string | null = null
    if (IMAGE_EXTS.has(ext) && stat.size <= MAX_THUMB_BYTES) {
      const image = nativeImage.createFromPath(path)
      if (!image.isEmpty()) thumb = image.resize({ width: 96 }).toDataURL()
    }
    return { kind: 'file', ext: ext.replace('.', '').slice(0, 4).toUpperCase(), thumb }
  } catch {
    return { kind: 'missing', ext: '', thumb: null }
  }
}

export function dragImage(id: string): Electron.NativeImage {
  const path = filePath(id)
  try {
    if (path && IMAGE_EXTS.has(extname(path).toLowerCase())) {
      const image = nativeImage.createFromPath(path)
      if (!image.isEmpty()) return image.resize({ width: 64 })
    }
  } catch {
    // fall through to the generic image
  }
  return nativeImage.createFromBuffer(trayPng(32))
}
