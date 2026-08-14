import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MediaDetailShell from './MediaDetailShell.js'

describe('MediaDetailShell', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders children inside the shell', () => {
    const onClose = vi.fn()
    render(
      <MediaDetailShell onClose={onClose}>
        <p>Detail content</p>
      </MediaDetailShell>,
    )
    expect(screen.getByText('Detail content')).toBeInTheDocument()
  })

  it('renders the × close button', () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    expect(screen.getByRole('button', { name: /fermer/i })).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', async () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    fireEvent.click(screen.getByRole('button', { name: /fermer/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    // Portal renders into document.body, not the container
    const backdrop = document.body.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks body scroll on mount', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
  })

  it('restores body scroll on unmount', () => {
    document.body.style.overflow = 'auto'
    const onClose = vi.fn()
    const { unmount } = render(
      <MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>,
    )
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('exposes role=dialog with aria-modal', () => {
    const onClose = vi.fn()
    render(<MediaDetailShell onClose={onClose}><p>content</p></MediaDetailShell>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
