import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { SeasonSummary } from '@iptvflix/api-contracts'
import SeasonAccordion from './SeasonAccordion.js'

function mkSeason(overrides: Partial<SeasonSummary> & Pick<SeasonSummary, 'seasonNumber'>): SeasonSummary {
  return {
    title: null,
    episodeCount: 5,
    availableEpisodeCount: 3,
    airYear: null,
    ...overrides,
  }
}

describe('SeasonAccordion', () => {
  it('shows no seasons fallback when seasons array is empty', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[]} />)
    expect(screen.getByText('Les saisons ne sont pas encore disponibles.')).toBeInTheDocument()
  })

  it('shows availableEpisodeCount / episodeCount fraction in header', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[mkSeason({ seasonNumber: 1, availableEpisodeCount: 3, episodeCount: 5 })]} />)
    expect(screen.getByText(/3 \/ 5 disponible/)).toBeInTheDocument()
  })

  it('shows "0 / N disponible" when no episodes available', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[mkSeason({ seasonNumber: 1, availableEpisodeCount: 0, episodeCount: 4 })]} />)
    expect(screen.getByText(/0 \/ 4 disponible/)).toBeInTheDocument()
  })

  it('does not show fraction when episodeCount is 0', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[mkSeason({ seasonNumber: 1, episodeCount: 0, availableEpisodeCount: 0 })]} />)
    expect(screen.queryByText(/\/ 0/)).not.toBeInTheDocument()
  })

  it('shows plural "disponibles" when availableEpisodeCount > 1', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[mkSeason({ seasonNumber: 1, availableEpisodeCount: 2, episodeCount: 5 })]} />)
    expect(screen.getByText(/2 \/ 5 disponibles/)).toBeInTheDocument()
  })

  it('shows singular "disponible" (not "disponibles") when availableEpisodeCount is 1', () => {
    render(<SeasonAccordion seriesId="s-1" seasons={[mkSeason({ seasonNumber: 1, availableEpisodeCount: 1, episodeCount: 5 })]} />)
    expect(screen.getByText(/1 \/ 5 disponible(?!s)/)).toBeInTheDocument()
  })
})
