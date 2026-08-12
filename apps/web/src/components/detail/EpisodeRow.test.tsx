import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { EpisodeResponse } from '@iptvflix/api-contracts'
import EpisodeRow from './EpisodeRow.js'

const BASE_EP: EpisodeResponse = {
  id: 'ep-1',
  episodeNumber: 1,
  title: 'Test Episode',
  synopsis: null,
  durationMinutes: 45,
  airDate: '2023-01-01',
  availabilityCount: 1,
  availabilityStatus: 'AVAILABLE',
  selectedVariantId: null,
  variants: [],
  watchState: null,
}

describe('EpisodeRow', () => {
  it('renders episode title and availability badge', () => {
    render(<EpisodeRow episode={BASE_EP} />)
    expect(screen.getByText('Test Episode')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('shows "Vu" indicator for watched state', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, watchState: 'watched' }} />)
    expect(screen.getByLabelText('Vu')).toBeInTheDocument()
  })

  it('shows "En cours" indicator for in_progress state', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, watchState: 'in_progress' }} />)
    expect(screen.getByLabelText('En cours')).toBeInTheDocument()
  })

  it('shows no watch state indicator when watchState is null', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, watchState: null }} />)
    expect(screen.queryByLabelText('Vu')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En cours')).not.toBeInTheDocument()
  })

  it('shows no watch state indicator for unwatched state', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, watchState: 'unwatched' }} />)
    expect(screen.queryByLabelText('Vu')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En cours')).not.toBeInTheDocument()
  })

  it('shows Indisponible badge and muted style for UNAVAILABLE episode', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, availabilityStatus: 'UNAVAILABLE', availabilityCount: 0 }} />)
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
    const container = screen.getByText('Test Episode').closest('.flex.gap-3')
    expect(container?.className).toContain('opacity-50')
  })

  it('uses episode number as fallback when title is null', () => {
    render(<EpisodeRow episode={{ ...BASE_EP, title: null }} />)
    expect(screen.getByText('Épisode 1')).toBeInTheDocument()
  })
})
