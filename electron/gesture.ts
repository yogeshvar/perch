import { existsSync } from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'

export type CocoaFrame = { x: number; y: number; width: number; height: number }

type Listener = {
  onDrag: (frame: CocoaFrame, delta: number, live: boolean) => void
  onRelease: () => void
  onTrust: (trusted: boolean) => void
}

let child: ChildProcessWithoutNullStreams | null = null
let trusted = false
let restarts = 0

export function gestureTrusted(): boolean {
  return trusted
}

export function startGesture(listener: Listener): void {
  const binary = helperPath()
  if (!binary) {
    console.error('Gesture helper is missing. Run npm run compile:gesture.')
    return
  }
  const proc = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  child = proc
  let pending = ''
  proc.stdout.on('data', (buf: Buffer) => {
    pending += buf.toString('utf8')
    let index = pending.indexOf('\n')
    while (index >= 0) {
      const line = pending.slice(0, index).trim()
      pending = pending.slice(index + 1)
      handleLine(line, listener)
      index = pending.indexOf('\n')
    }
  })
  proc.stderr.on('data', (buf: Buffer) => {
    const text = buf.toString('utf8').trim()
    if (text) console.error(text)
  })
  proc.on('exit', () => {
    if (child !== proc) return
    child = null
    if (restarts < 2) {
      restarts += 1
      setTimeout(() => startGesture(listener), 1000)
    }
  })
}

export function setGestureVisible(visible: boolean): void {
  child?.stdin.write(visible ? 'visible\n' : 'hidden\n')
}

export function promptGestureTrust(): void {
  child?.stdin.write('prompt-trust\n')
}

export function stopGesture(): void {
  restarts = 99
  child?.kill()
  child = null
}

function handleLine(line: string, listener: Listener): void {
  if (!line) return
  if (line === 'ready trusted' || line === 'trusted') {
    trusted = true
    listener.onTrust(true)
    return
  }
  if (line === 'ready untrusted') {
    trusted = false
    listener.onTrust(false)
    return
  }
  if (line === 'release') {
    listener.onRelease()
    return
  }
  if (line.startsWith('drag ')) {
    const parts = line.slice(5).split(' ').map(Number)
    if (parts.length !== 6 || parts.some((part) => Number.isNaN(part))) return
    const [x, y, width, height, delta, live] = parts
    listener.onDrag({ x, y, width, height }, delta, live === 1)
  }
}

function helperPath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'GestureHelper'),
    join(app.getAppPath(), 'native/bin/GestureHelper'),
    join(__dirname, '../../native/bin/GestureHelper')
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}
