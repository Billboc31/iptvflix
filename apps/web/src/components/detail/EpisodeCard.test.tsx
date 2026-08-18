import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { EpisodeResponse } from '@iptvflix/api-contracts'
import EpisodeCard from './EpisodeCard.js'

const BASE_EPISODE: EpisodeResponse = {
  id: 'ep-1',
  episodeNumber: 1,
  title: 'Pilot',
  synopsis: 'The first episode.',
  durationMinutes: 45,
  airDate: '2023-01-01',
  availabilityCount: 1,
  availabilityStatus: 'AVAILABLE',
  selectedVariantId: null,
  variants: [],
  watchState: null,
  posterUrl: null,
}

function renderCard(episode: EpisodeResponse = BASE_EPISODE) {
  return render(
    <MemoryRouter>
      <EpisodeCard episode={episode} />
    </MemoryRouter>,
  )
}

describe('EpisodeCard', () => {
  it('renders episode number, title, synopsis, and runtime', () => {
    renderCard()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Pilot')).toBeInTheDocument()
    expect(screen.getByText('The first episode.')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
  })

  it('shows "Vu" state when watchState is watched', () => {
    renderCard({ ...BASE_EPISODE, watchState: 'watched' })
    expect(screen.getByLabelText('Vu')).toBeInTheDocument()
  })

  it('shows "En cours" state when watchState is in_progress', () => {
    renderCard({ ...BASE_EPISODE, watchState: 'in_progress' })
    expect(screen.getByLabelText('En cours')).toBeInTheDocument()
  })

  it('shows play button when episode is available', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /lire l'épisode 1/i })).toBeInTheDocument()
  })

  it('labels play as Reprendre when progress is past 30 seconds', () => {
    render(
      <MemoryRouter>
        <EpisodeCard episode={BASE_EPISODE} progressMs={45_000} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /reprendre l'épisode 1/i })).toBeInTheDocument()
  })

  it('does not show play button when episode is unavailable', () => {
    renderCard({ ...BASE_EPISODE, availabilityStatus: 'UNAVAILABLE', availabilityCount: 0 })
    expect(screen.queryByRole('button', { name: /lire l'épisode/i })).not.toBeInTheDocument()
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
  })

  it('falls back to "Épisode N" when title is null', () => {
    renderCard({ ...BASE_EPISODE, title: null })
    expect(screen.getByText('Épisode 1')).toBeInTheDocument()
  })

  it('renders air date when present', () => {
    renderCard()
    expect(screen.getByText(/janv\./i)).toBeInTheDocument()
  })

  it('still image placeholder is present', () => {
    renderCard()
    // The placeholder div with aria-hidden emoji is present
    const placeholder = screen.getByText('🎬')
    expect(placeholder).toBeInTheDocument()
  })
})
