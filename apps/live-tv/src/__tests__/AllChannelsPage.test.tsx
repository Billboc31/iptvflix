import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AllChannelsPage from '../pages/AllChannelsPage.js'
import type { ChannelResponse } from '@iptvflix/api-contracts'

vi.mock('../lib/api.js', () => ({
  getChannelStream: vi.fn().mockResolvedValue({ streamUrl: 'http://example.com/stream' }),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, msg: string) { super(msg); this.status = status }
  },
}))

const channels: ChannelResponse[] = [
  { id: '1', name: 'TF1', logoUrl: null, categories: ['generalist'], language: 'fr' },
  { id: '2', name: 'beIN Sports', logoUrl: null, categories: ['sport'], language: 'ar' },
  { id: '3', name: 'Canal+', logoUrl: null, categories: ['cinema'], language: 'fr' },
]

const mockContext = {
  channels,
  isLoading: false,
  error: null,
  favoriteIds: new Set(['1']),
  toggleFavorite: vi.fn(),
  history: [],
  recordHistory: vi.fn(),
}

vi.mock('../context/ChannelsContext.js', () => ({
  useChannels: () => mockContext,
}))

vi.mock('../context/ProfileContext.js', () => ({
  useProfile: () => ({
    currentProfile: { id: 'p1', name: 'Test', preferredAudioLanguages: ['fr'] },
    profiles: [],
    isLoading: false,
    selectProfile: vi.fn(),
  }),
}))

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/channels${search}`]}>
      <AllChannelsPage />
    </MemoryRouter>,
  )
}

describe('AllChannelsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
    mockContext.favoriteIds = new Set(['1'])
  })

  it('renders all channels initially', () => {
    renderPage()
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.getByText('beIN Sports')).toBeInTheDocument()
    expect(screen.getByText('Canal+')).toBeInTheDocument()
  })

  it('filters channels by search query from URL', () => {
    renderPage('?q=tf1')
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports')).not.toBeInTheDocument()
  })

  it('filters channels by category from URL', () => {
    renderPage('?category=sport')
    expect(screen.getByText('beIN Sports')).toBeInTheDocument()
    expect(screen.queryByText('TF1')).not.toBeInTheDocument()
  })

  it('filters to profile language when Ma langue is active', () => {
    renderPage('?lang=mine')
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.getByText('Canal+')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports')).not.toBeInTheDocument()
  })

  it('filters to favorites only when toggled', () => {
    renderPage()
    const favBtn = screen.getByRole('button', { name: '♥ Favoris' })
    fireEvent.click(favBtn)
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports')).not.toBeInTheDocument()
  })

  it('calls toggleFavorite when favorite button is clicked', () => {
    renderPage()
    const rowFavBtn = screen.getByRole('button', { name: 'Retirer des favoris' })
    fireEvent.click(rowFavBtn)
    expect(mockContext.toggleFavorite).toHaveBeenCalled()
  })

  it('shows empty state when no channels match search', () => {
    renderPage('?q=zzznomatch')
    expect(screen.getByText(/aucune chaîne ne correspond/i)).toBeInTheDocument()
  })

  it('calls recordHistory when a channel play button is clicked', async () => {
    renderPage()
    const playButtons = screen.getAllByRole('button', { name: /regarder/i })
    fireEvent.click(playButtons[0])
    await waitFor(() => expect(mockContext.recordHistory).toHaveBeenCalledWith(channels[0].id))
  })
})
