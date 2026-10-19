import type { WebContents } from 'electron'

let send: ((channel: string, payload?: unknown) => void) | null = null

export function attachWebContents(contents: WebContents): void {
  send = (channel, payload) => {
    if (contents.isDestroyed()) return
    contents.send(channel, payload)
  }
}

export function emit(channel: string, payload?: unknown): void {
  send?.(channel, payload)
}
