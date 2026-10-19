import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaneHead } from '../../src/shelf/PaneHead'

describe('PaneHead', () => {
  it('shows the title, its actions and a collapse button when open', () => {
    const onToggle = vi.fn()
    render(
      <PaneHead title="Notes" collapsed={false} onToggle={onToggle} count={3}>
        <button type="button">Action</button>
      </PaneHead>
    )
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Notes' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('shows a rail with the title and count when collapsed, and expands on click', () => {
    const onToggle = vi.fn()
    render(<PaneHead title="Clipboard" collapsed onToggle={onToggle} count={5} />)
    const rail = screen.getByRole('button', { name: 'Expand Clipboard' })
    expect(rail).toHaveTextContent('Clipboard')
    expect(rail).toHaveTextContent('5')
    fireEvent.click(rail)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('leaves out the count when there is nothing to count', () => {
    const { rerender } = render(<PaneHead title="Files" collapsed onToggle={() => undefined} count={0} />)
    expect(screen.getByRole('button')).not.toHaveTextContent('0')
    rerender(<PaneHead title="Files" collapsed onToggle={() => undefined} />)
    expect(screen.getByRole('button')).toHaveTextContent(/^›Files$/)
  })
})
