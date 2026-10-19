import { vi } from 'vitest'

export type ITheme = Record<string, string>

export class Terminal {
  static instances: Terminal[] = []
  cols = 80
  rows = 24
  options: { theme?: ITheme } & Record<string, unknown>
  written: string[] = []
  resets = 0
  focused = 0
  disposed = false
  dataHandler: ((data: string) => void) | null = null

  constructor(options: Record<string, unknown> = {}) {
    this.options = options
    Terminal.instances.push(this)
  }

  loadAddon = vi.fn()
  open = vi.fn()
  onData(handler: (data: string) => void) {
    this.dataHandler = handler
  }
  write(chunk: string) {
    this.written.push(chunk)
  }
  reset() {
    this.resets += 1
  }
  focus() {
    this.focused += 1
  }
  dispose() {
    this.disposed = true
  }
}
