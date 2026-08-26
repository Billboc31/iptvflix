import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ChannelCard from '../components/channel/ChannelCard.js'
import type { ChannelResponse } from '@iptvflix/api-contracts'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

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

function renderCard(channel: ChannelResponse, props?: Partial<React.ComponentProps<typeof ChannelCard>>) {
  return render(
    <MemoryRouter>
      <ChannelCard channel={channel} {...props} />
    </MemoryRouter>,
  )
}

describe('ChannelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders LIVE badge', () => {
    renderCard(baseChannel)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('renders channel name', () => {
    renderCard(baseChannel)
    expect(screen.getByText('TF1')).toBeInTheDocument()
  })

  it('renders EPG program title when EPG is present', () => {
    renderCard(channelWithEpg)
    expect(screen.getByText('Journal de 20h')).toBeInTheDocument()
  })

  it('does not render EPG content when EPG is absent', () => {
    renderCard(baseChannel)
    expect(screen.queryByText('Journal de 20h')).not.toBeInTheDocument()
  })

  it('navigates to watch page on play', () => {
    renderCard(baseChannel)
    fireEvent.click(screen.getByRole('button', { name: /regarder TF1/i }))
    expect(navigateMock).toHaveBeenCalledWith('/watch/ch-1')
  })

  it('calls onPlay with channel id when provided', () => {
    const onPlay = vi.fn()
    renderCard(baseChannel, { onPlay })
    fireEvent.click(screen.getByRole('button', { name: /regarder TF1/i }))
    expect(onPlay).toHaveBeenCalledWith('ch-1')
  })

  it('calls onToggleFavorite when favorite button clicked', () => {
    const onToggleFavorite = vi.fn()
    renderCard(baseChannel, { onToggleFavorite, isFavorite: false })
    fireEvent.click(screen.getByRole('button', { name: /ajouter aux favoris/i }))
    expect(onToggleFavorite).toHaveBeenCalledOnce()
  })

  it('shows favorite as pressed when isFavorite=true', () => {
    const onToggleFavorite = vi.fn()
    renderCard(baseChannel, { onToggleFavorite, isFavorite: true })
    const btn = screen.getByRole('button', { name: /retirer des favoris/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
