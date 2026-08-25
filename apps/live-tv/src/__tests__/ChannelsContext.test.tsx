import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChannelsProvider, useChannels } from '../context/ChannelsContext.js'
import type { ChannelResponse, ChannelHistoryEntry } from '@iptvflix/api-contracts'

const mockChannels: ChannelResponse[] = [
  { id: '1', name: 'TF1', logoUrl: null, categories: [], isFavorite: true },
  { id: '2', name: 'France 2', logoUrl: null, categories: [], isFavorite: false },
]

const mockHistory: ChannelHistoryEntry[] = [
  { channelId: '1', name: 'TF1', logoUrl: null, watchedAt: new Date().toISOString() },
]

vi.mock('../lib/api.js', () => ({
  listChannels: vi.fn(),
  addFavorite: vi.fn().mockResolvedValue(undefined),
  removeFavorite: vi.fn().mockResolvedValue(undefined),
  listHistory: vi.fn(),
  recordHistory: vi.fn().mockResolvedValue(undefined),
}))

import { listChannels, listHistory, addFavorite, removeFavorite } from '../lib/api.js'

function TestConsumer() {
  const { channels, favoriteIds, history, toggleFavorite, recordHistory } = useChannels()
  return (
    <div>
      <div data-testid="channel-count">{channels.length}</div>
      <div data-testid="favorite-count">{favoriteIds.size}</div>
      <div data-testid="history-count">{history.length}</div>
      <button onClick={() => toggleFavorite('1')}>toggle-fav-1</button>
      <button onClick={() => toggleFavorite('2')}>toggle-fav-2</button>
      <button onClick={() => recordHistory('1')}>record-history</button>
    </div>
  )
}

describe('ChannelsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listChannels).mockResolvedValue(mockChannels)
    vi.mocked(listHistory).mockResolvedValue(mockHistory)
  })

  it('loads channels and initializes favoriteIds from isFavorite', async () => {
    render(<ChannelsProvider><TestConsumer /></ChannelsProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('channel-count').textContent).toBe('2')
      expect(screen.getByTestId('favorite-count').textContent).toBe('1')
    })
  })

  it('loads history entries', async () => {
    render(<ChannelsProvider><TestConsumer /></ChannelsProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('history-count').textContent).toBe('1')
    })
  })

  it('optimistically adds a favorite', async () => {
    render(<ChannelsProvider><TestConsumer /></ChannelsProvider>)
    await waitFor(() => expect(screen.getByTestId('favorite-count').textContent).toBe('1'))

    act(() => {
      screen.getByText('toggle-fav-2').click()
    })

    expect(screen.getByTestId('favorite-count').textContent).toBe('2')
    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith('2'))
  })

  it('optimistically removes a favorite', async () => {
    render(<ChannelsProvider><TestConsumer /></ChannelsProvider>)
    await waitFor(() => expect(screen.getByTestId('favorite-count').textContent).toBe('1'))

    act(() => {
      screen.getByText('toggle-fav-1').click()
    })

    expect(screen.getByTestId('favorite-count').textContent).toBe('0')
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith('1'))
  })

  it('recordHistory adds an entry to local history', async () => {
    vi.mocked(listHistory).mockResolvedValue([])
    render(<ChannelsProvider><TestConsumer /></ChannelsProvider>)
    await waitFor(() => expect(screen.getByTestId('history-count').textContent).toBe('0'))

    act(() => {
      screen.getByText('record-history').click()
    })

    expect(screen.getByTestId('history-count').textContent).toBe('1')
  })
})
