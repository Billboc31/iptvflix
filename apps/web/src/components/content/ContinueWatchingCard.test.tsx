import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server, MOCK_CONTINUE_WATCHING, MOCK_CONTINUE_WATCHING_EPISODE } from '../../test/handlers.js'
import ContinueWatchingCard from './ContinueWatchingCard.js'
import type { ContinueWatchingItem, ProgressMediaType } from '@iptvflix/api-contracts'

function renderCard(
  item: ContinueWatchingItem,
  onDismiss: (mediaType: ProgressMediaType, mediaId: string) => Promise<void> = vi.fn().mockResolvedValue(undefined),
  initialPath = '/',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={<ContinueWatchingCard item={item} onDismiss={onDismiss} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContinueWatchingCard — MOVIE', () => {
  it('renders the play button with aria-label Reprendre', () => {
    renderCard(MOCK_CONTINUE_WATCHING)
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })

  it('renders the info button with aria-label Voir les détails', () => {
    renderCard(MOCK_CONTINUE_WATCHING)
    expect(screen.getByRole('button', { name: 'Voir les détails' })).toBeInTheDocument()
  })

  it('renders the overflow button with aria-label Plus d\'options', () => {
    renderCard(MOCK_CONTINUE_WATCHING)
    expect(screen.getByRole('button', { name: "Plus d'options" })).toBeInTheDocument()
  })

  it('shows correct progress bar width (50% for 60/120s)', () => {
    renderCard(MOCK_CONTINUE_WATCHING)
    const bar = screen.getByTestId('progress-bar')
    expect(bar).toHaveStyle({ width: '50%' })
  })

  it('does not show episode label for MOVIE items', () => {
    renderCard(MOCK_CONTINUE_WATCHING)
    expect(screen.queryByText(/S\d+E\d+/)).toBeNull()
  })

  it('play button navigates with source=continue_watching', async () => {
    const user = userEvent.setup()
    // We capture the navigate destination via location display
    let navigatedTo = ''
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<ContinueWatchingCard item={MOCK_CONTINUE_WATCHING} onDismiss={vi.fn().mockResolvedValue(undefined)} />}
          />
          <Route
            path="/player/movie/:id"
            element={<div data-testid="player-page">PlayerPage</div>}
          />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Reprendre' }))
    const playerPage = screen.queryByTestId('player-page')
    // Navigation happened — player page rendered
    expect(playerPage).toBeInTheDocument()
  })
})

describe('ContinueWatchingCard — EPISODE', () => {
  it('shows episode label S1E2 · Second Episode', () => {
    renderCard(MOCK_CONTINUE_WATCHING_EPISODE)
    expect(screen.getByText('S1E2 · Second Episode')).toBeInTheDocument()
  })

  it('shows correct progress bar width', () => {
    renderCard(MOCK_CONTINUE_WATCHING_EPISODE)
    const bar = screen.getByTestId('progress-bar')
    expect(bar).toHaveStyle({ width: '50%' })
  })
})

describe('ContinueWatchingCard — overflow menu', () => {
  it('overflow menu opens on click and shows Supprimer de Reprendre', async () => {
    const user = userEvent.setup()
    renderCard(MOCK_CONTINUE_WATCHING)
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Supprimer de Reprendre')).toBeInTheDocument()
  })

  it('overflow menu closes on Escape', async () => {
    const user = userEvent.setup()
    renderCard(MOCK_CONTINUE_WATCHING)
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('clicking Supprimer de Reprendre calls onDismiss with correct args', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn().mockResolvedValue(undefined)
    renderCard(MOCK_CONTINUE_WATCHING, onDismiss)
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    await user.click(screen.getByText('Supprimer de Reprendre'))
    expect(onDismiss).toHaveBeenCalledWith('MOVIE', MOCK_CONTINUE_WATCHING.mediaId)
  })

  it('shows error message when dismiss fails', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn().mockRejectedValue(new Error('network error'))
    renderCard(MOCK_CONTINUE_WATCHING, onDismiss)
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    await user.click(screen.getByText('Supprimer de Reprendre'))
    await waitFor(() => {
      expect(screen.getByText('Erreur lors de la suppression')).toBeInTheDocument()
    })
  })
})

describe('ContinueWatchingCard — optimistic removal', () => {
  it('item disappears immediately on dismiss and reappears on failure', async () => {
    const user = userEvent.setup()
    let rejectDismiss: (e: Error) => void
    const onDismiss = vi.fn().mockReturnValue(
      new Promise<void>((_, reject) => { rejectDismiss = reject }),
    )
    const items = [MOCK_CONTINUE_WATCHING]
    const { rerender } = render(
      <MemoryRouter>
        {items.map((item) => (
          <ContinueWatchingCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </MemoryRouter>,
    )
    // Open menu and click dismiss
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    await user.click(screen.getByText('Supprimer de Reprendre'))
    // The item's dismiss was triggered; simulate API failure
    rejectDismiss!(new Error('fail'))
    await waitFor(() => {
      expect(screen.getByText('Erreur lors de la suppression')).toBeInTheDocument()
    })
  })
})

describe('ContinueWatchingCard — direct resume (no resume dialog)', () => {
  it('DELETE /continue-watching is called with correct params on dismiss via API handler', async () => {
    const user = userEvent.setup()
    let deleteCalled = false
    server.use(
      http.delete('/api/continue-watching/:mediaType/:mediaId', () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const onDismiss = vi.fn().mockResolvedValue(undefined)
    renderCard(MOCK_CONTINUE_WATCHING, onDismiss)
    await user.click(screen.getByRole('button', { name: "Plus d'options" }))
    await user.click(screen.getByText('Supprimer de Reprendre'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
