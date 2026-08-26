import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LiveRail from '../components/channel/LiveRail.js'
import type { ChannelResponse } from '@iptvflix/api-contracts'

const channels: ChannelResponse[] = [
  { id: '1', name: 'TF1', logoUrl: null, categories: [] },
  { id: '2', name: 'France 2', logoUrl: null, categories: [] },
]

function renderRail(props: Partial<React.ComponentProps<typeof LiveRail>> = {}) {
  return render(
    <MemoryRouter>
      <LiveRail title="En direct" channels={channels} isLoading={false} {...props} />
    </MemoryRouter>,
  )
}

describe('LiveRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not loading and channels is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <LiveRail title="En direct" channels={[]} isLoading={false} />
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders skeleton cards when loading', () => {
    const { container } = render(
      <MemoryRouter>
        <LiveRail title="En direct" channels={[]} isLoading={true} />
      </MemoryRouter>,
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })

  it('renders channel cards when data is present', () => {
    renderRail()
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.getByText('France 2')).toBeInTheDocument()
  })

  it('renders section title', () => {
    render(
      <MemoryRouter>
        <LiveRail title="En direct maintenant" channels={channels} isLoading={false} />
      </MemoryRouter>,
    )
    expect(screen.getByText('En direct maintenant')).toBeInTheDocument()
  })

  it('calls onRecordHistory when a card is played', () => {
    const onRecordHistory = vi.fn()
    renderRail({ onRecordHistory })
    fireEvent.click(screen.getByRole('button', { name: 'Regarder TF1' }))
    expect(onRecordHistory).toHaveBeenCalledWith('1')
  })
})
