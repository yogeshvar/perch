import { vi } from 'vitest'

export class FakePty {
  static instances: FakePty[] = []
  dataHandler: ((chunk: string) => void) | null = null
  exitHandler: ((event: { exitCode: number }) => void) | null = null
  killed = false
  written: string[] = []
  killError: Error | null = null
  writeError: Error | null = null
  resizeError: Error | null = null
  resizes: [number, number][] = []

  constructor(
    public command: string,
    public args: string[],
    public options: Record<string, unknown>
  ) {
    FakePty.instances.push(this)
  }

  onData(handler: (chunk: string) => void) {
    this.dataHandler = handler
  }
  onExit(handler: (event: { exitCode: number }) => void) {
    this.exitHandler = handler
  }
  write(data: string) {
    if (this.writeError) throw this.writeError
    this.written.push(data)
  }
  resize(cols: number, rows: number) {
    if (this.resizeError) throw this.resizeError
    this.resizes.push([cols, rows])
  }
  kill() {
    if (this.killError) throw this.killError
    this.killed = true
  }
  /** Test helpers */
  emitData(chunk: string) {
    this.dataHandler?.(chunk)
  }
  emitExit(exitCode: number) {
    this.exitHandler?.({ exitCode })
  }
}

export const spawn = vi.fn((command: string, args: string[], options: Record<string, unknown>) => new FakePty(command, args, options))

export function resetPty(): void {
  FakePty.instances = []
  spawn.mockClear()
  spawn.mockImplementation((command, args, options) => new FakePty(command, args, options))
}

export default { spawn }
