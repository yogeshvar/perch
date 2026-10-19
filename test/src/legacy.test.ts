import { afterEach, describe, expect, it, vi } from 'vitest'
import { adoptLegacyKey } from '../../src/shared/legacy'

afterEach(() => vi.restoreAllMocks())

describe('adoptLegacyKey', () => {
  it('copies a value saved under the old key, and keeps the old one', () => {
    localStorage.setItem('ledge-x', 'old value')
    adoptLegacyKey('ledge-x', 'perch-x')
    expect(localStorage.getItem('perch-x')).toBe('old value')
    expect(localStorage.getItem('ledge-x')).toBe('old value')
  })

  it('never overwrites a value already saved under the new key', () => {
    localStorage.setItem('ledge-x', 'old value')
    localStorage.setItem('perch-x', 'new value')
    adoptLegacyKey('ledge-x', 'perch-x')
    expect(localStorage.getItem('perch-x')).toBe('new value')
  })

  it('does nothing when there is nothing to carry over', () => {
    adoptLegacyKey('ledge-x', 'perch-x')
    expect(localStorage.getItem('perch-x')).toBeNull()
  })

  it('does nothing, quietly, when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => adoptLegacyKey('ledge-x', 'perch-x')).not.toThrow()
  })
})
