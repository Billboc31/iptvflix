import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { EpisodeResponse, DeviceResponse } from '@iptvflix/api-contracts'
import { ToastProvider } from '../ui/Toast.js'
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

const MOCK_DEVICE: DeviceResponse = {
  id: 'device-1',
  name: 'Salon TV',
  lastSeenAt: new Date(Date.now() - 10_000).toISOString(),
  revokedAt: null,
  createdAt: new Date('2024-01-01').toISOString(),
}

function renderRow(episode = BASE_EP, devices: DeviceResponse[] = []) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <EpisodeRow episode={episode} devices={devices} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('EpisodeRow', () => {
  it('renders episode title and availability badge', () => {
    renderRow()
    expect(screen.getByText('Test Episode')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('shows "Vu" indicator for watched state', () => {
    renderRow({ ...BASE_EP, watchState: 'watched' })
    expect(screen.getByLabelText('Vu')).toBeInTheDocument()
  })

  it('shows "En cours" indicator for in_progress state', () => {
    renderRow({ ...BASE_EP, watchState: 'in_progress' })
    expect(screen.getByLabelText('En cours')).toBeInTheDocument()
  })

  it('shows no watch state indicator when watchState is null', () => {
    renderRow({ ...BASE_EP, watchState: null })
    expect(screen.queryByLabelText('Vu')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En cours')).not.toBeInTheDocument()
  })

  it('shows no watch state indicator for unwatched state', () => {
    renderRow({ ...BASE_EP, watchState: 'unwatched' })
    expect(screen.queryByLabelText('Vu')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En cours')).not.toBeInTheDocument()
  })

  it('shows Indisponible badge and muted style for UNAVAILABLE episode', () => {
    renderRow({ ...BASE_EP, availabilityStatus: 'UNAVAILABLE', availabilityCount: 0 })
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
    const container = screen.getByText('Test Episode').closest('.flex.gap-3')
    expect(container?.className).toContain('opacity-50')
  })

  it('uses episode number as fallback when title is null', () => {
    renderRow({ ...BASE_EP, title: null })
    expect(screen.getByText('Épisode 1')).toBeInTheDocument()
  })

  it('shows TV button when devices are provided and episode is available', () => {
    renderRow(BASE_EP, [MOCK_DEVICE])
    expect(screen.getByLabelText("Lire l'épisode 1 sur TV")).toBeInTheDocument()
  })

  it('does not show TV button when no devices', () => {
    renderRow(BASE_EP, [])
    expect(screen.queryByLabelText("Lire l'épisode 1 sur TV")).not.toBeInTheDocument()
  })

  it('does not show TV button for UNAVAILABLE episode even with devices', () => {
    renderRow({ ...BASE_EP, availabilityStatus: 'UNAVAILABLE' }, [MOCK_DEVICE])
    expect(screen.queryByLabelText("Lire l'épisode 1 sur TV")).not.toBeInTheDocument()
  })
})
