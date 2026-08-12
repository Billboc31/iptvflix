import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HeroSection from './HeroSection.js'
import { PreviewProvider } from '../../contexts/PreviewContext.js'

function renderHero(props: Parameters<typeof HeroSection>[0]) {
  return render(
    <PreviewProvider>
      <HeroSection {...props} />
    </PreviewProvider>,
  )
}

describe('HeroSection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
    renderHero({ title: 'Inception' })
    expect(screen.getByText('Inception')).toBeInTheDocument()
  })

  it('does not mount preview player without trailerKey', async () => {
    renderHero({ title: 'Movie', mediaId: 'movie-1' })
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('does not mount preview player without mediaId', async () => {
    renderHero({ title: 'Movie', trailerKey: 'abc123' })
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('mounts preview player after 2s delay when trailerKey and mediaId are provided', async () => {
    renderHero({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123' })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
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
    renderHero({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123' })
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('cleans up timer and deactivates on unmount', async () => {
    const { unmount } = renderHero({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123' })
    unmount()
    await act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

})
