import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LiveRail from '../components/channel/LiveRail.js'
import type { ChannelResponse } from '@iptvflix/api-contracts'

vi.mock('../lib/api.js', () => ({
  getChannelStream: vi.fn().mockResolvedValue({ streamUrl: 'http://example.com/stream' }),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, msg: string) { super(msg); this.status = status }
  },
}))

const channels: ChannelResponse[] = [
  { id: '1', name: 'TF1', logoUrl: null, categories: [] },
  { id: '2', name: 'France 2', logoUrl: null, categories: [] },
]

describe('LiveRail', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  it('renders nothing when not loading and channels is empty', () => {
    const { container } = render(
      <LiveRail title="En direct" channels={[]} isLoading={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders skeleton cards when loading', () => {
    const { container } = render(
      <LiveRail title="En direct" channels={[]} isLoading={true} />,
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })

  it('renders channel cards when data is present', () => {
    render(<LiveRail title="En direct" channels={channels} isLoading={false} />)
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.getByText('France 2')).toBeInTheDocument()
  })

  it('renders section title', () => {
    render(<LiveRail title="En direct maintenant" channels={channels} isLoading={false} />)
    expect(screen.getByText('En direct maintenant')).toBeInTheDocument()
  })

  it('calls onRecordHistory when a card is played', async () => {
    const onRecordHistory = vi.fn()
    render(
      <LiveRail
        title="En direct"
        channels={channels}
        isLoading={false}
        onRecordHistory={onRecordHistory}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Regarder TF1' }))
    await waitFor(() => expect(onRecordHistory).toHaveBeenCalledWith('1'))
  })
})
