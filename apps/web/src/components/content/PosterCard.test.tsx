import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/handlers.js'
import PosterCard from './PosterCard.js'
import { PreviewProvider } from '../../contexts/PreviewContext.js'

function renderCard(props: Parameters<typeof PosterCard>[0]) {
  return render(
    <PreviewProvider>
      <PosterCard {...props} />
    </PreviewProvider>,
  )
}

describe('PosterCard', () => {
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

  it('renders title and year', () => {
    renderCard({ title: 'Inception', year: 2010 })
    expect(screen.getAllByText('Inception').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2010')).toBeInTheDocument()
  })

  it('renders quality badge when quality is provided', () => {
    renderCard({ title: 'Movie', quality: 'HD' })
    expect(screen.getByText('HD')).toBeInTheDocument()
  })

  it('does not render year when null', () => {
    renderCard({ title: 'Movie', year: null })
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    renderCard({ title: 'Movie', onClick })
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not mount preview when trailerKey is null', async () => {
    renderCard({ title: 'NoTrailer', mediaId: 'movie-1', trailerKey: null, onClick: () => {} })
    await act(async () => {
      fireEvent.mouseEnter(screen.getByRole('button'))
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('starts preview after 1.5s hover delay', async () => {
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    const card = screen.getByRole('button')
    fireEvent.mouseEnter(card)
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
  })

  it('cancels preview when mouse leaves before delay fires', async () => {
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    const card = screen.getByRole('button')
    await act(async () => {
      fireEvent.mouseEnter(card)
      vi.advanceTimersByTime(500)
      fireEvent.mouseLeave(card)
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
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
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    const card = screen.getByRole('button')
    await act(async () => {
      fireEvent.mouseEnter(card)
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('does not start preview when autoplayPreviews is false', async () => {
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          id: 'p1',
          name: 'Default',
          preferences: {
            preferredAudioLanguages: [],
            preferredSubtitleLanguages: [],
            preferredSourceIds: [],
            maxVideoQuality: null,
            autoplayPreviews: false,
          },
        }),
      ),
    )
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    // Flush profile fetch before firing timer
    await act(async () => {})
    const card = screen.getByRole('button')
    await act(async () => {
      fireEvent.mouseEnter(card)
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })

  it('focus triggers preview after 1.5s', async () => {
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    const card = screen.getByRole('button')
    fireEvent.focus(card)
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
  })

  it('blur cancels preview', async () => {
    renderCard({ title: 'Movie', mediaId: 'movie-1', trailerKey: 'abc123', onClick: () => {} })
    const card = screen.getByRole('button')
    await act(async () => {
      fireEvent.focus(card)
      vi.advanceTimersByTime(500)
      fireEvent.blur(card)
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('preview-iframe')).not.toBeInTheDocument()
  })
})
