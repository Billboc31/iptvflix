import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/handlers.js'
import { MOCK_EPISODES } from '../../test/handlers.js'
import SeasonSelector from './SeasonSelector.js'
import type { SeasonSummary } from '@iptvflix/api-contracts'

const SEASONS: SeasonSummary[] = [
  { seasonNumber: 1, title: 'Saison 1', episodeCount: 3, availableEpisodeCount: 2, airYear: 2023 },
  { seasonNumber: 2, title: null, episodeCount: 2, availableEpisodeCount: 0, airYear: 2024 },
]

function renderSelector(seasons = SEASONS) {
  return render(
    <MemoryRouter>
      <SeasonSelector seriesId="series-1" seasons={seasons} />
    </MemoryRouter>,
  )
}

describe('SeasonSelector', () => {
  it('renders a dropdown with all seasons', async () => {
    renderSelector()
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Saison 1/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Saison 2/i })).toBeInTheDocument()
  })

  it('auto-loads episodes for the first season on mount', async () => {
    renderSelector()
    await waitFor(() => {
      expect(screen.getByText('Pilot')).toBeInTheDocument()
    })
    expect(screen.getByText('Second Episode')).toBeInTheDocument()
  })

  it('changes episode list when season is changed', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/series/:id/seasons/:seasonNumber/episodes', ({ params }) => {
        const sn = Number((params as { seasonNumber: string }).seasonNumber)
        if (sn === 2) return HttpResponse.json([{ ...MOCK_EPISODES[0], title: 'S2E1', id: 's2e1' }])
        return HttpResponse.json(MOCK_EPISODES)
      }),
    )
    renderSelector()
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())

    await user.selectOptions(screen.getByRole('combobox'), '2')
    await waitFor(() => {
      expect(screen.getByText('S2E1')).toBeInTheDocument()
    })
    expect(screen.queryByText('Pilot')).not.toBeInTheDocument()
  })

  it('shows fallback message when seasons array is empty', () => {
    renderSelector([])
    expect(screen.getByText('Chargement des saisons…')).toBeInTheDocument()
  })

  it('caches season episodes and does not re-fetch on re-select', async () => {
    const user = userEvent.setup()
    let fetchCount = 0
    server.use(
      http.get('/api/series/:id/seasons/:seasonNumber/episodes', () => {
        fetchCount++
        return HttpResponse.json(MOCK_EPISODES)
      }),
    )
    renderSelector()
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())
    // Switch to season 2
    await user.selectOptions(screen.getByRole('combobox'), '2')
    await waitFor(() => expect(fetchCount).toBe(2))
    // Switch back to season 1 — should use cache
    await user.selectOptions(screen.getByRole('combobox'), '1')
    await waitFor(() => expect(screen.getByText('Pilot')).toBeInTheDocument())
    expect(fetchCount).toBe(2)
  })
})
