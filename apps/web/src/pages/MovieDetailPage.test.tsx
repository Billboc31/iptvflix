import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { MOCK_MOVIE, MOCK_UNMATCHED_MOVIE } from '../test/handlers.js'
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
})
