import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { MOCK_MOVIE, MOCK_UNMATCHED_MOVIE, MOCK_MOVIE_NO_TRAILER } from '../test/handlers.js'
import MovieDetailPage from './MovieDetailPage.js'

function renderPage(id = 'movie-1') {
  return render(
    <MemoryRouter initialEntries={[`/movies/${id}`]}>
      <Routes>
        <Route path="/movies/:id" element={<MovieDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MovieDetailPage', () => {
  it('renders title, year, genres and synopsis from MovieDetailResponse', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE.title })).toBeInTheDocument()
    })
    expect(screen.getByText(String(MOCK_MOVIE.year))).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(MOCK_MOVIE.synopsis!)).toBeInTheDocument()
  })

  it('renders originalTitle as subtitle when it differs from title', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(MOCK_MOVIE.originalTitle!)).toBeInTheDocument()
    })
  })

  it('shows no enrichment badge when enrichmentStatus is matched', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE.title })).toBeInTheDocument()
    })
    expect(screen.queryByText('Données manquantes')).not.toBeInTheDocument()
    expect(screen.queryByText('Données partielles')).not.toBeInTheDocument()
  })

  it('shows "Données manquantes" badge when enrichmentStatus is unmatched', async () => {
    server.use(
      http.get('/api/movies/:id', () => HttpResponse.json(MOCK_UNMATCHED_MOVIE)),
    )
    renderPage('movie-2')
    await waitFor(() => {
      expect(screen.getByText('Données manquantes')).toBeInTheDocument()
    })
  })

  it('shows "Données partielles" badge when enrichmentStatus is partial', async () => {
    server.use(
      http.get('/api/movies/:id', () =>
        HttpResponse.json({ ...MOCK_MOVIE, enrichmentStatus: 'partial' }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Données partielles')).toBeInTheDocument()
    })
  })

  it('shows not-found message when API returns 404', async () => {
    server.use(
      http.get('/api/movies/:id', () => new HttpResponse(null, { status: 404 })),
    )
    renderPage('unknown-id')
    await waitFor(() => {
      expect(screen.getByText('Ce film est introuvable.')).toBeInTheDocument()
    })
  })

  it('shows error state on network failure', async () => {
    server.use(
      http.get('/api/movies/:id', () => new HttpResponse(null, { status: 500 })),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
    })
  })

  it('shows voteAverage and certification when present', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE.title })).toBeInTheDocument()
    })
    expect(screen.getByText(/★ 7\.9/)).toBeInTheDocument()
    expect(screen.getByText('PG-13')).toBeInTheDocument()
  })

  it('shows bande-annonce button when trailerKey is present', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bande-annonce/i })).toBeInTheDocument()
    })
  })

  it('does not show bande-annonce button when trailerKey is null', async () => {
    server.use(
      http.get('/api/movies/:id', () => HttpResponse.json(MOCK_MOVIE_NO_TRAILER)),
    )
    renderPage('movie-3')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE_NO_TRAILER.title })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /bande-annonce/i })).not.toBeInTheDocument()
  })

  it('shows cast member names when cast is present', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
    expect(screen.getByText('John Smith')).toBeInTheDocument()
  })

  it('shows director name when present', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument()
    })
  })

  it('does not show cast section when cast is empty and director is null', async () => {
    server.use(
      http.get('/api/movies/:id', () => HttpResponse.json(MOCK_MOVIE_NO_TRAILER)),
    )
    renderPage('movie-3')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE_NO_TRAILER.title })).toBeInTheDocument()
    })
    expect(screen.queryByText(/Casting/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Réalisateur/i)).not.toBeInTheDocument()
  })

  it('loads trailer iframe on bande-annonce button click', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bande-annonce/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /bande-annonce/i }))
    expect(screen.getByTitle(/trailer/i)).toHaveAttribute('src', expect.stringContaining('abc123'))
  })

  it('play button is enabled when movie is AVAILABLE', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE.title })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /lecture/i })).not.toBeDisabled()
  })

  it('play button is disabled and labelled "Non disponible" when movie is UNAVAILABLE', async () => {
    server.use(
      http.get('/api/movies/:id', () => HttpResponse.json(MOCK_UNMATCHED_MOVIE)),
    )
    renderPage('movie-2')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /non disponible/i })).toBeDisabled()
    })
  })

  it('renders Titres similaires section', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_MOVIE.title })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Titres similaires')).toBeInTheDocument()
    })
  })
})
