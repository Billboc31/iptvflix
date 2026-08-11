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
})
