import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/handlers.js'
import { MOCK_SIMILAR_MOVIE, MOCK_SIMILAR_SERIES } from '../../test/handlers.js'
import SimilarTitlesShelf from './SimilarTitlesShelf.js'

function LocationDisplay() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderShelf(mediaType: 'MOVIE' | 'SERIES', mediaId = 'media-1') {
  return render(
    <MemoryRouter initialEntries={['/detail']}>
      <Routes>
        <Route path="/detail" element={<SimilarTitlesShelf mediaType={mediaType} mediaId={mediaId} />} />
        <Route path="/movies/:id" element={<LocationDisplay />} />
        <Route path="/series/:id" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SimilarTitlesShelf', () => {
  it('renders similar movie titles from API', async () => {
    renderShelf('MOVIE')
    await waitFor(() => {
      // PosterCard renders title in two places when no poster — use getAllByText
      expect(screen.getAllByText(MOCK_SIMILAR_MOVIE.title).length).toBeGreaterThan(0)
    })
  })

  it('renders similar series titles from API', async () => {
    renderShelf('SERIES')
    await waitFor(() => {
      expect(screen.getAllByText(MOCK_SIMILAR_SERIES.title).length).toBeGreaterThan(0)
    })
  })

  it('shows catalog-only entry (no sources) without hiding it', async () => {
    renderShelf('MOVIE')
    // MOCK_SIMILAR_MOVIE has availabilityStatus UNAVAILABLE — card should still appear with badge
    await waitFor(() => {
      expect(screen.getByText(/indisponible/i)).toBeInTheDocument()
    })
  })

  it('clicking a movie card navigates to /movies/:id', async () => {
    const user = userEvent.setup()
    renderShelf('MOVIE')
    await waitFor(() =>
      expect(screen.getAllByText(MOCK_SIMILAR_MOVIE.title).length).toBeGreaterThan(0),
    )
    // PosterCard renders a div with role="button" — click the first card
    const cards = screen.getAllByRole('button').filter((b) =>
      b.textContent?.includes(MOCK_SIMILAR_MOVIE.title),
    )
    await user.click(cards[0])
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(`/movies/${MOCK_SIMILAR_MOVIE.id}`)
    })
  })

  it('clicking a series card navigates to /series/:id', async () => {
    const user = userEvent.setup()
    renderShelf('SERIES')
    await waitFor(() =>
      expect(screen.getAllByText(MOCK_SIMILAR_SERIES.title).length).toBeGreaterThan(0),
    )
    const cards = screen.getAllByRole('button').filter((b) =>
      b.textContent?.includes(MOCK_SIMILAR_SERIES.title),
    )
    await user.click(cards[0])
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(`/series/${MOCK_SIMILAR_SERIES.id}`)
    })
  })

  it('renders nothing when API returns empty array', async () => {
    server.use(http.get('/api/movies/:id/similar', () => HttpResponse.json([])))
    const { container } = renderShelf('MOVIE')
    await waitFor(() => {
      expect(container.querySelector('section')).not.toBeInTheDocument()
    })
  })

  it('renders nothing on API error', async () => {
    server.use(http.get('/api/movies/:id/similar', () => new HttpResponse(null, { status: 500 })))
    const { container } = renderShelf('MOVIE')
    await waitFor(() => {
      expect(container.querySelector('section')).not.toBeInTheDocument()
    })
  })
})
