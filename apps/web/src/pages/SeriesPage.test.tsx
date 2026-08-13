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

  it('renders Disponibles and Toutes les séries shelf rows by default', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Disponibles')).toBeInTheDocument()
      expect(screen.getByText('Toutes les séries')).toBeInTheDocument()
    })
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

  it('filters to a genre shelf when a genre chip is selected', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Drama' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Drama' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Drama' })).toBeInTheDocument()
      expect(screen.queryByText('Toutes les séries')).not.toBeInTheDocument()
    })
  })
})
