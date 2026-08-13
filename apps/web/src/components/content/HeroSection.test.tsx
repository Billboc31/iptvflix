import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HeroSection from './HeroSection.js'

const mockUsePreview = vi.hoisted(() => vi.fn())

vi.mock('../../contexts/PreviewContext.js', () => ({
  usePreview: () => mockUsePreview(),
}))

describe('HeroSection', () => {
  beforeEach(() => {
    mockUsePreview.mockReturnValue({
      activeId: null as string | null,
      activeKey: null as string | null,
      activate: vi.fn(),
      deactivate: vi.fn(),
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate'] })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the title', () => {
    render(<HeroSection title="Inception" />)
    expect(screen.getByText('Inception')).toBeInTheDocument()
  })

  it('does not mount preview player without trailerKey', async () => {
    render(<HeroSection title="Movie" mediaId="movie-1" />)
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('does not mount preview player without mediaId', async () => {
    render(<HeroSection title="Movie" trailerKey="abc123" />)
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('mounts preview player after 2s delay when trailerKey and mediaId are provided', async () => {
    const activate = vi.fn()
    mockUsePreview.mockReturnValue({ activeId: null, activeKey: null, activate, deactivate: vi.fn() })
    render(<HeroSection title="Movie" mediaId="movie-1" trailerKey="abc123" />)
    expect(activate).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTime(2000))
    expect(activate).toHaveBeenCalledWith('movie-1', 'abc123')
  })

  it('does not start preview on touch devices', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    render(<HeroSection title="Movie" mediaId="movie-1" trailerKey="abc123" />)
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('cleans up timer and deactivates on unmount', async () => {
    const { unmount } = render(<HeroSection title="Movie" mediaId="movie-1" trailerKey="abc123" />)
    unmount()
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('shows mute button when preview is active', () => {
    mockUsePreview.mockReturnValue({ activeId: 'movie-1', activeKey: 'abc123', activate: vi.fn(), deactivate: vi.fn() })
    render(<HeroSection title="Movie" mediaId="movie-1" trailerKey="abc123" />)
    expect(screen.getByRole('button', { name: 'Activer le son' })).toBeInTheDocument()
    expect(screen.getByText('Son coupé')).toBeInTheDocument()
  })

  it('clicking mute button toggles muted state', async () => {
    mockUsePreview.mockReturnValue({ activeId: 'movie-1', activeKey: 'abc123', activate: vi.fn(), deactivate: vi.fn() })
    render(<HeroSection title="Movie" mediaId="movie-1" trailerKey="abc123" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activer le son' }))
    })
    expect(screen.getByRole('button', { name: 'Couper le son' })).toBeInTheDocument()
    expect(screen.getByText('Son activé')).toBeInTheDocument()
  })
})
