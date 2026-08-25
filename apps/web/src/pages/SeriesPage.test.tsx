import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SeriesPage from './SeriesPage.js'

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

vi.mock('../hooks/useSeriesPage.js', () => ({
  useInfiniteSeriesPage: () => ({
    allShelves: [
      {
        id: 'rec-s1',
        title: 'Séries pour toi',
        type: 'GENERATED',
        layoutHint: 'ROW',
        shelfInstanceId: 'rec-s1',
        items: [
          {
            mediaType: 'SERIES',
            mediaId: 's1',
            title: 'Rec Series',
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
      <SeriesPage />
    </MemoryRouter>,
  )
}

describe('SeriesPage', () => {
  it('renders a Hero section with the featured series title', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('The Test Series').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not show a Play button (series playability is episode-driven)', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('The Test Series').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByRole('button', { name: 'Lire' })).not.toBeInTheDocument()
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
      expect(screen.getByText('Séries pour toi')).toBeInTheDocument()
    })
    expect(screen.queryByText('Populaires')).not.toBeInTheDocument()
  })

  it('shows no hero when API returns no series', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/series', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lire' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: "Plus d'infos" })).not.toBeInTheDocument()
    })
  })

  it('shows genre results above personalized shelves when a genre chip is selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument()
      expect(screen.getByText('Séries pour toi')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Drama' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Drama' })).toBeInTheDocument()
      expect(screen.getByText('Séries pour toi')).toBeInTheDocument()
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
      expect(screen.getByText('Séries pour toi')).toBeInTheDocument()
    })
  })
})
