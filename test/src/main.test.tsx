import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { installPerch } from '../helpers/perch'
import { setSystemPrefersLight } from '../helpers/setup-dom'

describe('renderer entry point', () => {
  it('applies the theme and mounts the app into #root', async () => {
    vi.resetModules()
    installPerch()
    setSystemPrefersLight(true)
    document.body.innerHTML = '<div id="root"></div>'
    await act(async () => {
      await import('../../src/main')
    })
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.querySelector('#root .shelf')).toBeInTheDocument()
  })

  it('fails loudly when the page has no #root', async () => {
    vi.resetModules()
    installPerch()
    document.body.innerHTML = ''
    await expect(import('../../src/main')).rejects.toThrow('Missing root')
  })
})
