import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SearchPage from './SearchPage.js'

function renderPage(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/search${initialSearch}`]}>
      <SearchPage />
    </MemoryRouter>,
  )
}

describe('SearchPage', () => {
  it('renders search input', () => {
    renderPage()
    expect(
      screen.getByPlaceholderText('Rechercher films, séries…'),
    ).toBeInTheDocument()
  })

  it('shows results after typing a query', async () => {
    renderPage()
    const input = screen.getByPlaceholderText('Rechercher films, séries…')
    await userEvent.type(input, 'test')

    await waitFor(
      () => {
        expect(screen.getAllByText('The Test Movie').length).toBeGreaterThanOrEqual(1)
      },
      { timeout: 2000 },
    )
  })

  it('shows both movies and series sections in results', async () => {
    renderPage()
    await userEvent.type(
      screen.getByPlaceholderText('Rechercher films, séries…'),
      'test',
    )

    await waitFor(
      () => {
        expect(screen.getByText(/^Films/)).toBeInTheDocument()
        expect(screen.getByText(/^Séries/)).toBeInTheDocument()
      },
      { timeout: 1000 },
    )
  })

  it('shows empty state when no results found', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/search', () => HttpResponse.json({ movies: [], series: [] })),
    )
    renderPage()
    await userEvent.type(screen.getByPlaceholderText('Rechercher films, séries…'), 'xyz')
    await waitFor(
      () => {
        expect(screen.getByText('Aucun résultat')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('shows error state when API call fails', async () => {
    const { server } = await import('../test/handlers.js')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/search', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 }),
      ),
    )
    renderPage()
    await userEvent.type(screen.getByPlaceholderText('Rechercher films, séries…'), 'fail')
    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })
})
