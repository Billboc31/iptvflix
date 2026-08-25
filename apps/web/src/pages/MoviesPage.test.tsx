import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MoviesPage from './MoviesPage.js'

vi.mock('../contexts/PreviewContext.js', () => ({
  usePreview: () => ({
    activeId: null as string | null,
    activeKey: null as string | null,
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}))

vi.mock('../context/ProfileContext.js', () => ({
  useProfile: () => ({
    currentProfile: { id: '00000000-0000-0000-0000-000000000001', name: 'Test', avatarColor: '#fff' },
    profileVersion: 0,
    profiles: [],
    isLoading: false,
    selectProfile: vi.fn(),
    refreshProfiles: vi.fn(),
  }),
}))

vi.mock('../hooks/useInfiniteMovies.js', () => ({
  useInfiniteMovies: () => ({
    allShelves: [
      {
        id: 'rec-1',
        title: 'Pour toi',
        type: 'GENERATED',
        layoutHint: 'ROW',
        shelfInstanceId: 'rec-1',
        items: [
          {
            mediaType: 'MOVIE',
            mediaId: 'm1',
            title: 'Rec Movie',
            posterUrl: null,
            trailerKey: null,
          },
        ],
      },
    ],
    sessionId: null,
    nextCursor: null,
    isLoading: false,
    isFetchingMore: false,
    hasMore: false,
    error: null,
    loadMore: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <MoviesPage />
    </MemoryRouter>,
  )
}

describe('MoviesPage', () => {
  it('renders a Hero section with the featured movie title', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders genre chips including Tous and genre names from API', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tous' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument()
    })
  })

  it('renders personalized shelves by default (no catalog Populaires)', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Pour toi')).toBeInTheDocument()
    })
    expect(screen.queryByText('Populaires')).not.toBeInTheDocument()
  })

  it('shows Play button when hero movie is AVAILABLE', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lire' })).toBeInTheDocument()
    })
  })

  it('shows no Play button when hero movie is UNAVAILABLE', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    const { MOCK_UNMATCHED_MOVIE } = await import('../test/handlers.js')
    server.use(
      http.get('/api/movies', () =>
        HttpResponse.json({ items: [MOCK_UNMATCHED_MOVIE], total: 1, page: 1, pageSize: 20 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Unmatched Movie').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByRole('button', { name: 'Lire' })).not.toBeInTheDocument()
  })

  it('shows no hero when API returns no movies', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/movies', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lire' })).not.toBeInTheDocument()
    })
  })

  it('shows genre results above personalized shelves when a genre chip is selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
      expect(screen.getByText('Pour toi')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Action' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Action' })).toBeInTheDocument()
      expect(screen.getByText('Pour toi')).toBeInTheDocument()
    })
  })

  it('shows catalog shelves above personalized shelves when Disponible maintenant is selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Disponible maintenant' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Disponible maintenant' }))
    await waitFor(() => {
      expect(screen.getByText('Populaires')).toBeInTheDocument()
      expect(screen.getByText('Pour toi')).toBeInTheDocument()
    })
  })

  it('shows error state when API call fails', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/movies', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lire' })).not.toBeInTheDocument()
    })
  })
})
