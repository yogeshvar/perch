import { afterEach, beforeEach, vi } from 'vitest'
import { resetElectron } from '../mocks/electron'

beforeEach(() => {
  resetElectron()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
