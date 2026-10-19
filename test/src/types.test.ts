import { describe, expect, it } from 'vitest'
import { isPresetId, PRESETS, presetLabel } from '../../src/shared/types'

describe('presets', () => {
  it('lists the four tools', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['claude', 'codex', 'shell', 'custom'])
  })

  it('labels each preset, with a generic label for anything unknown', () => {
    expect(presetLabel('claude')).toBe('Claude Code')
    expect(presetLabel('custom')).toBe('Custom')
    expect(presetLabel('vim' as never)).toBe('Tool')
  })

  it('recognises only real preset ids', () => {
    for (const id of ['claude', 'codex', 'shell', 'custom']) expect(isPresetId(id)).toBe(true)
    for (const bad of ['emacs', '', null, undefined, 3, {}]) expect(isPresetId(bad)).toBe(false)
  })
})
