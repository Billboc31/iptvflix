import { render, screen, fireEvent } from '@testing-library/react'
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
  { id: '1', name: 'TF1', logoUrl: null, categories: ['Généralistes'] },
  { id: '2', name: 'beIN Sports', logoUrl: null, categories: ['Sport'] },
  { id: '3', name: 'Canal+', logoUrl: null, categories: ['Cinéma & Séries'] },
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
    renderPage('?category=Sport')
    expect(screen.getByText('beIN Sports')).toBeInTheDocument()
    expect(screen.queryByText('TF1')).not.toBeInTheDocument()
  })

  it('filters to favorites only when toggled', () => {
    renderPage()
    // The filter toggle button has the text "♥ Favoris" (with the heart)
    const favBtn = screen.getByRole('button', { name: '♥ Favoris' })
    fireEvent.click(favBtn)
    expect(screen.getByText('TF1')).toBeInTheDocument()
    expect(screen.queryByText('beIN Sports')).not.toBeInTheDocument()
  })

  it('calls toggleFavorite when favorite button is clicked', () => {
    renderPage()
    // Use specific aria-label to get a row-level favorite toggle
    const rowFavBtn = screen.getByRole('button', { name: 'Retirer des favoris' })
    fireEvent.click(rowFavBtn)
    expect(mockContext.toggleFavorite).toHaveBeenCalled()
  })

  it('shows empty state when no channels match search', () => {
    renderPage('?q=zzznomatch')
    expect(screen.getByText(/aucune chaîne ne correspond/i)).toBeInTheDocument()
  })
})
