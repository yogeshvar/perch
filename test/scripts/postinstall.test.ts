import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  statuses: [] as (number | null)[],
  calls: [] as { command: string; args: string[]; options: Record<string, unknown> }[]
}))

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn((command: string, args: string[], options: Record<string, unknown>) => {
    hoisted.calls.push({ command, args, options })
    return { status: hoisted.statuses.length ? hoisted.statuses.shift() : 0 }
  })
}))
const mkdirSync = vi.fn()
vi.mock('node:fs', () => ({ mkdirSync: (...args: unknown[]) => mkdirSync(...args) }))

const root = resolve(__dirname, '../..')

async function run(statuses: (number | null)[]) {
  vi.resetModules()
  hoisted.statuses = [...statuses]
  hoisted.calls = []
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`)
  }) as never)
  // @ts-expect-error the install script is plain JavaScript without type declarations
  const result = await import('../../scripts/postinstall.mjs').then(
    () => 'finished',
    (error: Error) => error.message
  )
  exit.mockRestore()
  return result
}

afterEach(() => {
  mkdirSync.mockClear()
})

describe('postinstall', () => {
  it('compiles the Swift helper, then rebuilds the native modules for Electron', async () => {
    expect(await run([0, 0])).toBe('finished')
    expect(mkdirSync).toHaveBeenCalledWith(resolve(root, 'native/bin'), { recursive: true })
    expect(hoisted.calls.map((c) => c.command)).toEqual(['swiftc', 'electron-rebuild'])
    expect(hoisted.calls[0].args).toEqual([
      '-swift-version', '5', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos13.0`, '-O', '-framework', 'AppKit', '-framework', 'ApplicationServices',
      '-o', 'native/bin/GestureHelper', 'native/GestureHelper.swift'
    ])
    expect(hoisted.calls[1].args).toEqual(['-f', '-w', 'node-pty,better-sqlite3'])
    expect(hoisted.calls.every((c) => c.options.cwd === root && c.options.stdio === 'inherit')).toBe(true)
  })

  it('targets x86_64 when run on an Intel Mac', async () => {
    const original = process.arch
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    try {
      await run([0, 0])
    } finally {
      Object.defineProperty(process, 'arch', { value: original, configurable: true })
    }
    const args = hoisted.calls[0].args
    expect(args[args.indexOf('-target') + 1]).toBe('x86_64-apple-macos13.0')
  })

  it('stops with swiftc\'s exit code when compiling fails, without rebuilding', async () => {
    expect(await run([2])).toBe('exit:2')
    expect(hoisted.calls.map((c) => c.command)).toEqual(['swiftc'])
  })

  it('exits 1 when swiftc could not run at all (no status)', async () => {
    expect(await run([null])).toBe('exit:1')
  })

  it('stops with the rebuild exit code when electron-rebuild fails', async () => {
    expect(await run([0, 7])).toBe('exit:7')
  })

  it('exits 1 when electron-rebuild could not run at all', async () => {
    expect(await run([0, null])).toBe('exit:1')
  })
})
