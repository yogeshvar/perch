import { mkdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nativeImage } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachWebContents } from '../../electron/bus'
import { openDatabase } from '../../electron/db'
import { addFiles, clearFiles, dragImage, fileInfo, filePath, listFiles, removeFile, startFiles } from '../../electron/files'
import { FakeImage } from '../mocks/electron'
import { tempDir } from '../helpers/tmp'

let dir: string
let sent: [string, unknown][]

beforeEach(() => {
  dir = tempDir()
  sent = []
  attachWebContents({ isDestroyed: () => false, send: (c: string, p: unknown) => sent.push([c, p]) } as never)
  startFiles(openDatabase(dir))
  vi.mocked(nativeImage.createFromBuffer).mockImplementation((buffer: Buffer) => new FakeImage(false, 32, 32, buffer) as never)
})

const file = (name: string, content = 'x') => {
  const path = join(dir, name)
  writeFileSync(path, content)
  return path
}

describe('addFiles', () => {
  it('stores references to existing absolute paths, newest first, and announces the list', () => {
    const a = file('a.txt')
    const b = file('b.txt')
    const list = addFiles([a, b])
    expect(list.map((f) => f.name)).toEqual(['a.txt', 'b.txt'])
    expect(list[0]).toMatchObject({ path: a, name: 'a.txt' })
    expect(sent.at(-1)).toEqual(['files:changed', list])
  })

  it('skips relative paths, missing files and duplicates', () => {
    const a = file('a.txt')
    addFiles([a])
    const list = addFiles(['relative/file.txt', join(dir, 'nope.txt'), a])
    expect(list).toHaveLength(1)
  })

  it('accepts folders too', () => {
    const folder = join(dir, 'Work')
    mkdirSync(folder)
    expect(addFiles([folder])[0].name).toBe('Work')
  })

  it('only takes the first 200 paths of a huge drop', () => {
    const paths = Array.from({ length: 205 }, (_, i) => file(`f${i}.txt`))
    expect(addFiles(paths)).toHaveLength(200)
  })
})

describe('removeFile and clearFiles', () => {
  it('removes one file reference without touching the file on disk', () => {
    const a = file('a.txt')
    const b = file('b.txt')
    const [first] = addFiles([a, b])
    expect(removeFile(first.id).map((f) => f.name)).toEqual(['b.txt'])
    expect(() => writeFileSync(a, 'still there')).not.toThrow()
  })

  it('clears everything', () => {
    addFiles([file('a.txt'), file('b.txt')])
    expect(clearFiles()).toEqual([])
    expect(listFiles()).toEqual([])
  })
})

describe('filePath', () => {
  it('maps an id to its path, or null for an unknown id', () => {
    const a = file('a.txt')
    const [first] = addFiles([a])
    expect(filePath(first.id)).toBe(a)
    expect(filePath('nope')).toBeNull()
  })
})

describe('fileInfo', () => {
  it('says missing for an unknown id', () => {
    expect(fileInfo('nope')).toEqual({ kind: 'missing', ext: '', thumb: null })
  })

  it('describes a folder', () => {
    const folder = join(dir, 'Work')
    mkdirSync(folder)
    const [entry] = addFiles([folder])
    expect(fileInfo(entry.id)).toEqual({ kind: 'folder', ext: '', thumb: null })
  })

  it('describes a plain file by its upper-cased extension (at most 4 characters)', () => {
    const [entry] = addFiles([file('notes.markdown')])
    expect(fileInfo(entry.id)).toEqual({ kind: 'file', ext: 'MARK', thumb: null })
  })

  it('shows an empty extension for a file with none', () => {
    const [entry] = addFiles([file('README')])
    expect(fileInfo(entry.id)).toEqual({ kind: 'file', ext: '', thumb: null })
  })

  it('builds a small thumbnail for an image', () => {
    const [entry] = addFiles([file('photo.PNG')])
    const info = fileInfo(entry.id)
    expect(info).toMatchObject({ kind: 'file', ext: 'PNG' })
    expect(info.thumb).toMatch(/^data:image\/png;base64,/)
    expect(nativeImage.createFromPath).toHaveBeenCalledWith(join(dir, 'photo.PNG'))
  })

  it('has no thumbnail when the image cannot be decoded', () => {
    vi.mocked(nativeImage.createFromPath).mockReturnValue(new FakeImage(true) as never)
    const [entry] = addFiles([file('broken.jpg')])
    expect(fileInfo(entry.id)).toEqual({ kind: 'file', ext: 'JPG', thumb: null })
  })

  it('does not decode images over 15 MB', () => {
    const path = file('huge.png')
    const [entry] = addFiles([path])
    truncateSync(path, 16 * 1024 * 1024)
    expect(fileInfo(entry.id)).toEqual({ kind: 'file', ext: 'PNG', thumb: null })
    expect(nativeImage.createFromPath).not.toHaveBeenCalled()
  })

  it('reports missing when the file vanished after it was added', () => {
    const path = file('gone.txt')
    const [entry] = addFiles([path])
    rmSync(path)
    expect(fileInfo(entry.id)).toEqual({ kind: 'missing', ext: '', thumb: null })
  })
})

describe('dragImage', () => {
  it('uses a resized copy of an image file', () => {
    const [entry] = addFiles([file('photo.png')])
    const image = dragImage(entry.id) as unknown as FakeImage
    expect(image.getSize().width).toBe(64)
  })

  it('falls back to the generic image for non-images and unknown ids', () => {
    const [entry] = addFiles([file('notes.txt')])
    expect(dragImage(entry.id)).toBeInstanceOf(FakeImage)
    expect(dragImage('nope')).toBeInstanceOf(FakeImage)
    expect(nativeImage.createFromBuffer).toHaveBeenCalledTimes(2)
  })

  it('falls back when the image is empty or decoding throws', () => {
    const [entry] = addFiles([file('photo.png')])
    vi.mocked(nativeImage.createFromPath).mockReturnValueOnce(new FakeImage(true) as never)
    expect(dragImage(entry.id).getSize().width).toBe(32)
    vi.mocked(nativeImage.createFromPath).mockImplementationOnce(() => {
      throw new Error('decode failed')
    })
    expect(dragImage(entry.id).getSize().width).toBe(32)
  })
})

describe('before startFiles is called', () => {
  it('is inert instead of throwing', async () => {
    vi.resetModules()
    const fresh = await import('../../electron/files')
    expect(fresh.listFiles()).toEqual([])
    expect(fresh.addFiles(['/x'])).toEqual([])
    expect(fresh.filePath('x')).toBeNull()
    expect(fresh.removeFile('x')).toEqual([])
    expect(fresh.clearFiles()).toEqual([])
  })
})
