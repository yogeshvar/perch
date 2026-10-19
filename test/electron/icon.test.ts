import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { trayPng } from '../../electron/icon'

function chunks(png: Buffer) {
  const found: { type: string; data: Buffer }[] = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    found.push({ type: png.subarray(offset + 4, offset + 8).toString('ascii'), data: png.subarray(offset + 8, offset + 8 + length) })
    offset += 12 + length
  }
  return found
}

describe('trayPng', () => {
  it('produces a valid RGBA PNG of the requested size', () => {
    const png = trayPng(22)
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const [ihdr, idat, iend] = chunks(png)
    expect([ihdr.type, idat.type, iend.type]).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect(ihdr.data.readUInt32BE(0)).toBe(22)
    expect(ihdr.data.readUInt32BE(4)).toBe(22)
    expect([ihdr.data[8], ihdr.data[9]]).toEqual([8, 6])
    expect(inflateSync(idat.data)).toHaveLength(22 * (1 + 22 * 4))
  })

  it('defaults to 22px and scales with the requested size', () => {
    expect(chunks(trayPng())[0].data.readUInt32BE(0)).toBe(22)
    expect(chunks(trayPng(32))[0].data.readUInt32BE(0)).toBe(32)
  })

  it('draws the shelf glyph: a top bar and a box outline on a transparent background', () => {
    const size = 22
    const raw = inflateSync(chunks(trayPng(size))[1].data)
    const alpha = (x: number, y: number) => raw[y * (1 + size * 4) + 1 + x * 4 + 3]
    expect(alpha(10, 3)).toBe(255) // top bar
    expect(alpha(1, 3)).toBe(0) // outside the bar's padding
    // the bar runs from x=4 up to (not including) x=18, two rows thick
    expect([3, 4, 17, 18].map((x) => alpha(x, 3))).toEqual([0, 255, 255, 0])
    expect([alpha(10, 2), alpha(10, 4), alpha(10, 5)]).toEqual([0, 255, 0])
    expect(alpha(5, 10)).toBe(255) // box left edge
    expect(alpha(10, 7)).toBe(255) // box top edge
    expect(alpha(10, 12)).toBe(0) // box interior is hollow
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(21, 21)).toBe(0) // beyond the box
  })

  it('has valid CRCs on every chunk', () => {
    const png = trayPng(22)
    let offset = 8
    while (offset < png.length) {
      const length = png.readUInt32BE(offset)
      const body = png.subarray(offset + 4, offset + 8 + length)
      const stored = png.readUInt32BE(offset + 8 + length)
      let c = 0xffffffff
      for (const byte of body) {
        c ^= byte
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      expect((c ^ 0xffffffff) >>> 0).toBe(stored)
      offset += 12 + length
    }
  })
})
