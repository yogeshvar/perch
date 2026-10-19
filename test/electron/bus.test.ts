import { describe, expect, it, vi } from 'vitest'

async function freshBus() {
  vi.resetModules()
  return import('../../electron/bus')
}

describe('bus', () => {
  it('drops messages until a window is attached', async () => {
    const bus = await freshBus()
    expect(() => bus.emit('x', 1)).not.toThrow()
  })

  it('forwards channel and payload to the attached window', async () => {
    const bus = await freshBus()
    const send = vi.fn()
    bus.attachWebContents({ isDestroyed: () => false, send } as never)
    bus.emit('clips:changed', [1, 2])
    bus.emit('shelf:shown')
    expect(send).toHaveBeenNthCalledWith(1, 'clips:changed', [1, 2])
    expect(send).toHaveBeenNthCalledWith(2, 'shelf:shown', undefined)
  })

  it('stops sending once the window is destroyed', async () => {
    const bus = await freshBus()
    const send = vi.fn()
    bus.attachWebContents({ isDestroyed: () => true, send } as never)
    bus.emit('x')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends to the most recently attached window only', async () => {
    const bus = await freshBus()
    const first = vi.fn()
    const second = vi.fn()
    bus.attachWebContents({ isDestroyed: () => false, send: first } as never)
    bus.attachWebContents({ isDestroyed: () => false, send: second } as never)
    bus.emit('x')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
