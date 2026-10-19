import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { Terminal } from '../mocks/xterm'
import { FitAddon } from '../mocks/addon-fit'

// jsdom has no layout engine, matchMedia, ResizeObserver or PointerEvent.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  observed: Element[] = []
  disconnected = false
  constructor(public callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }
  observe(target: Element) {
    this.observed.push(target)
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

class FakePointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}

let systemPrefersLight = false

beforeEach(() => {
  systemPrefersLight = false
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('PointerEvent', FakePointerEvent)
  window.matchMedia = ((query: string) => ({
    matches: query.includes('light') ? systemPrefersLight : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia
  Element.prototype.setPointerCapture = vi.fn()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  Terminal.instances = []
  FitAddon.instances = []
  FakeResizeObserver.instances = []
})

afterEach(() => {
  cleanup()
  document.body.className = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

export { FakeResizeObserver }
export const setSystemPrefersLight = (value: boolean) => {
  systemPrefersLight = value
}
