import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChannelCard from '../components/channel/ChannelCard.js'
import type { ChannelResponse } from '@iptvflix/api-contracts'

vi.mock('../lib/api.js', () => ({
  getChannelStream: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

import { getChannelStream } from '../lib/api.js'

const baseChannel: ChannelResponse = {
  id: 'ch-1',
  name: 'TF1',
  logoUrl: null,
  categories: ['Généralistes'],
}

const channelWithEpg: ChannelResponse = {
  ...baseChannel,
  epg: {
    now: {
      title: 'Journal de 20h',
      startTime: '2030-01-01T18:00:00Z',
      endTime: '2030-01-01T20:30:00Z',
    },
  },
}

describe('ChannelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getChannelStream).mockResolvedValue({ streamUrl: 'http://example.com/stream.m3u8' })
    vi.stubGlobal('open', vi.fn())
  })

  it('renders LIVE badge', () => {
    render(<ChannelCard channel={baseChannel} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('renders channel name', () => {
    render(<ChannelCard channel={baseChannel} />)
    expect(screen.getByText('TF1')).toBeInTheDocument()
  })

  it('renders EPG program title when EPG is present', () => {
    render(<ChannelCard channel={channelWithEpg} />)
    expect(screen.getByText('Journal de 20h')).toBeInTheDocument()
  })

  it('does not render EPG content when EPG is absent', () => {
    render(<ChannelCard channel={baseChannel} />)
    expect(screen.queryByText('Journal de 20h')).not.toBeInTheDocument()
  })

  it('calls getChannelStream on play and opens stream', async () => {
    render(<ChannelCard channel={baseChannel} />)
    fireEvent.click(screen.getByRole('button', { name: /regarder TF1/i }))

    await waitFor(() => {
      expect(getChannelStream).toHaveBeenCalledWith('ch-1')
      expect(window.open).toHaveBeenCalledWith('http://example.com/stream.m3u8', '_blank', 'noopener')
    })
  })

  it('shows error message when stream is unavailable', async () => {
    const { ApiError } = await import('../lib/api.js')
    vi.mocked(getChannelStream).mockRejectedValue(new ApiError(404, 'Not found'))

    render(<ChannelCard channel={baseChannel} />)
    fireEvent.click(screen.getByRole('button', { name: /regarder TF1/i }))

    await waitFor(() => {
      expect(screen.getByText('Flux indisponible')).toBeInTheDocument()
    })
  })

  it('calls onToggleFavorite when favorite button clicked', () => {
    const onToggleFavorite = vi.fn()
    render(<ChannelCard channel={baseChannel} onToggleFavorite={onToggleFavorite} isFavorite={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ajouter aux favoris/i }))
    expect(onToggleFavorite).toHaveBeenCalledOnce()
  })

  it('shows favorite as pressed when isFavorite=true', () => {
    const onToggleFavorite = vi.fn()
    render(<ChannelCard channel={baseChannel} onToggleFavorite={onToggleFavorite} isFavorite={true} />)
    const btn = screen.getByRole('button', { name: /retirer des favoris/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
