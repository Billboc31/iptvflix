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
  { id: '1', name: 'TF1', logoUrl: null, categories: ['generalist'], language: 'fr', country: 'FR', iptvOrgId: 'TF1.fr' },
  { id: '2', name: 'beIN Sports 1', logoUrl: null, categories: ['sport'], language: 'fr', country: 'FR', iptvOrgId: 'beINSports1.fr' },
  { id: '3', name: 'Canal+', logoUrl: null, categories: ['cinema'], language: 'fr', country: 'FR', iptvOrgId: 'CanalPlus.fr' },
]

const mockContext = {
  channels,
  isLoading: false,
  error: null,
  catalog: 'curated' as const,
  country: 'FR',
  setCatalog: vi.fn(),
  setCountry: vi.fn(),
  favoriteIds: new Set(['1']),
  toggleFavorite: vi.fn(),
  history: [],
  recordHistory: vi.fn(),
}

vi.mock('../context/ChannelsContext.js', () => ({
  useChannels: () => mockContext,
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
    mockContext.setCatalog.mockClear()
  })

  it('renders curated channels', () => {
    renderPage()
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.getByText('beIN Sports 1')).toBeInTheDocument()
  })

  it('filters channels by search query from URL', () => {
    renderPage('?q=tf1')
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports 1')).not.toBeInTheDocument()
  })

  it('filters channels by category from URL', () => {
    renderPage('?category=sport')
    expect(screen.getByText('beIN Sports 1')).toBeInTheDocument()
    expect(screen.queryByText('TF1')).not.toBeInTheDocument()
  })

  it('switches to raw catalog via chip', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Catalogue brut' }))
    expect(mockContext.setCatalog).toHaveBeenCalledWith('all')
  })

  it('filters to favorites only when toggled', () => {
    renderPage()
    const favBtn = screen.getByRole('button', { name: '♥ Favoris' })
    fireEvent.click(favBtn)
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports 1')).not.toBeInTheDocument()
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
