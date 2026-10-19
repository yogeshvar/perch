import { describe, expect, it, vi } from 'vitest'

async function load() {
  vi.resetModules()
  const electron = await import('../mocks/electron')
  await import('../../electron/preload')
  const perch = electron.contextBridge.exposed.perch as Record<string, (...args: unknown[]) => unknown>
  return { ...electron, perch }
}

describe('preload bridge', () => {
  it('exposes one `perch` object to the page', async () => {
    const { contextBridge, perch } = await load()
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('perch', perch)
  })

  it('fire-and-forget methods use ipcRenderer.send with the right channel and arguments', async () => {
    const { ipcRenderer, perch } = await load()
    const cases: [string, unknown[], string, unknown[]][] = [
      ['hide', [], 'shelf:hide', []],
      ['writePty', ['ls'], 'pty:write', ['ls']],
      ['resizePty', [80, 24], 'pty:resize', [80, 24]],
      ['resizeShelf', [500], 'shelf:resize', [500]],
      ['resizeShelfEnd', [], 'shelf:resize-end', []],
      ['revealFile', ['f1'], 'files:reveal', ['f1']],
      ['dragFile', ['f1'], 'files:drag', ['f1']],
      ['keepOpen', [], 'shelf:keep-open', []],
      ['promptGesture', [], 'gesture:prompt', []],
      ['quit', [], 'app:quit', []],
      ['setTrayVisible', [false], 'app:set-tray-visible', [false]],
      ['setLaunchAtLogin', [true], 'app:set-launch-at-login', [true]]
    ]
    for (const [method, args, channel, sent] of cases) {
      ipcRenderer.send.mockClear()
      perch[method](...args)
      expect(ipcRenderer.send, method).toHaveBeenCalledWith(channel, ...sent)
    }
  })

  it('request methods use ipcRenderer.invoke and return its promise', async () => {
    const { ipcRenderer, perch } = await load()
    ipcRenderer.invoke.mockResolvedValue('answer' as never)
    const cases: [string, unknown[], string, unknown[]][] = [
      ['getState', [], 'app:get-state', []],
      ['saveLayout', [0.4, 0.2, 0.2], 'settings:layout', [0.4, 0.2, 0.2]],
      ['configureTool', [{ presetId: 'shell' }], 'tool:configure', [{ presetId: 'shell' }]],
      ['restartTool', [], 'tool:restart', []],
      ['ptySnapshot', [], 'pty:snapshot', []],
      ['sendToTool', ['hi'], 'tool:send', ['hi']],
      ['openInClaude', ['hi', 'code'], 'claude:open', ['hi', 'code']],
      ['copyClip', ['c'], 'clips:copy', ['c']],
      ['toggleFavorite', ['c'], 'clips:favorite', ['c']],
      ['deleteClip', ['c'], 'clips:delete', ['c']],
      ['clearHistory', [], 'clips:clear', []],
      ['createNote', [], 'notes:create', []],
      ['updateNote', ['n', 'body'], 'notes:update', ['n', 'body']],
      ['renameNote', ['n', 'Title'], 'notes:rename', ['n', 'Title']],
      ['deleteNote', ['n'], 'notes:delete', ['n']],
      ['addFiles', [['/a']], 'files:add', [['/a']]],
      ['removeFile', ['f'], 'files:remove', ['f']],
      ['clearFiles', [], 'files:clear', []],
      ['openFile', ['f'], 'files:open', ['f']],
      ['fileInfo', ['f'], 'files:info', ['f']]
    ]
    for (const [method, args, channel, sent] of cases) {
      ipcRenderer.invoke.mockClear()
      await expect(perch[method](...args), method).resolves.toBe('answer')
      expect(ipcRenderer.invoke, method).toHaveBeenCalledWith(channel, ...sent)
    }
  })

  it('resolves a dropped file to its real path with webUtils', async () => {
    const { webUtils, perch } = await load()
    expect(perch.pathForFile({ name: 'a.txt' })).toBe('/dropped/a.txt')
    expect(webUtils.getPathForFile).toHaveBeenCalledWith({ name: 'a.txt' })
  })

  it('subscribes to each event channel and returns an unsubscribe function', async () => {
    const { ipcRenderer, perch } = await load()
    const events: [string, string][] = [
      ['onPtyData', 'pty:data'],
      ['onPtyReset', 'pty:reset'],
      ['onPtyExit', 'pty:exit'],
      ['onToolStatus', 'tool:status'],
      ['onClips', 'clips:changed'],
      ['onNotes', 'notes:changed'],
      ['onFiles', 'files:changed'],
      ['onShown', 'shelf:shown'],
      ['onGestureTrust', 'gesture:trust'],
      ['onPrefs', 'prefs:changed']
    ]
    for (const [method, channel] of events) {
      const callback = vi.fn()
      const off = perch[method](callback) as () => void
      ipcRenderer.deliver(channel, { payload: channel })
      expect(callback, method).toHaveBeenCalledWith({ payload: channel })
      off()
      ipcRenderer.deliver(channel, 'again')
      expect(callback, `${method} after unsubscribe`).toHaveBeenCalledTimes(1)
      expect(ipcRenderer.listenerCount(channel)).toBe(0)
    }
  })
})
