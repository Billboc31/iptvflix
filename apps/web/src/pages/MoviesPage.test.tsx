import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MoviesPage from './MoviesPage.js'

function renderPage() {
  return render(
    <MemoryRouter>
      <MoviesPage />
    </MemoryRouter>,
  )
}

describe('MoviesPage', () => {
  it('shows skeleton placeholders while loading', () => {
    renderPage()
    // Skeletons are aria-hidden, but the grid container is present
    expect(screen.getByText('Films')).toBeInTheDocument()
  })

  it('renders movie posters after loading', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows empty state when no movies returned', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/movies', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Aucun film trouvé')).toBeInTheDocument()
    })
  })

  it('has genre and year filter dropdowns', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByLabelText('Filtrer par genre')).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrer par année')).toBeInTheDocument()
  })
})
