import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { MOCK_SERIES, MOCK_EPISODES } from '../test/handlers.js'
import SeriesDetailPage from './SeriesDetailPage.js'

function renderPage(id = 'series-1') {
  return render(
    <MemoryRouter initialEntries={[`/series/${id}`]}>
      <Routes>
        <Route path="/series/:id" element={<SeriesDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SeriesDetailPage', () => {
  it('renders season list from SeriesDetailResponse.seasons', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: MOCK_SERIES.title })).toBeInTheDocument()
    })
    expect(screen.getByText(/Saison 1/)).toBeInTheDocument()
    expect(screen.getByText(/Saison 2/)).toBeInTheDocument()
  })

  it('expanding a season fetches and displays its episode list', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Saison 1/)).toBeInTheDocument()
    })

    const seasonBtn = screen.getAllByRole('button').find((btn) =>
      btn.textContent?.includes('Saison 1'),
    )
    expect(seasonBtn).toBeDefined()
    await user.click(seasonBtn!)

    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })
    expect(screen.getByText('Second Episode')).toBeInTheDocument()
  })

  it('shows fallback message when seasons array is empty', async () => {
    server.use(
      http.get('/api/series/:id', () =>
        HttpResponse.json({ ...MOCK_SERIES, seasons: [], seasonCount: 0 }),
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText('Les saisons ne sont pas encore disponibles.'),
      ).toBeInTheDocument()
    })
  })

  it('shows "Données partielles" badge for partial enrichment', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Données partielles')).toBeInTheDocument()
    })
  })

  it('shows not-found message when API returns 404', async () => {
    server.use(
      http.get('/api/series/:id', () => new HttpResponse(null, { status: 404 })),
    )
    renderPage('unknown-id')
    await waitFor(() => {
      expect(screen.getByText('Cette série est introuvable.')).toBeInTheDocument()
    })
  })

  it('caches episodes so a second expand does not re-fetch', async () => {
    const user = userEvent.setup()
    let fetchCount = 0
    server.use(
      http.get('/api/series/:id/seasons/:seasonNumber/episodes', () => {
        fetchCount++
        return HttpResponse.json(MOCK_EPISODES)
      }),
    )

    renderPage()
    await waitFor(() => expect(screen.getByText(/Saison 1/)).toBeInTheDocument())

    const [seasonBtn] = screen.getAllByRole('button').filter((btn) =>
      btn.textContent?.includes('Saison 1'),
    )
    await user.click(seasonBtn)
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())

    // Collapse and re-expand
    await user.click(seasonBtn)
    await user.click(seasonBtn)
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())

    expect(fetchCount).toBe(1)
  })
})
