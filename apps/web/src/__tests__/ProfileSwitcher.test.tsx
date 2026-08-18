import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../test/handlers.js'
import { ProfileProvider } from '../context/ProfileContext.js'
import { MOCK_PROFILE_A, MOCK_PROFILE_B, MOCK_SELECT_PROFILE_RESPONSE } from '../test/handlers.js'
import ProfileSwitcherPopover from '../components/ProfileSwitcherPopover.js'

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

function renderSwitcher() {
  return render(
    <MemoryRouter>
      <ProfileProvider>
        <ProfileSwitcherPopover />
      </ProfileProvider>
    </MemoryRouter>,
  )
}

describe('ProfileSwitcherPopover', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('iptvflix_last_profile_id', MOCK_PROFILE_A.id)
    server.use(
      http.post('/api/profiles/:id/select', () =>
        HttpResponse.json(MOCK_SELECT_PROFILE_RESPONSE),
      ),
    )
  })

  it('renders current profile avatar and name after load', async () => {
    renderSwitcher()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())
  })

  it('opens popover on click and shows all profiles', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /changer de profil/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText(MOCK_PROFILE_B.name)).toBeInTheDocument()
    expect(screen.getByText('Tom')).toBeInTheDocument()
  })

  it('clicking another profile calls selectProfile', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    // Override AFTER auto-select so the initial load uses the default (Alice) handler
    server.use(
      http.post('/api/profiles/:id/select', () =>
        HttpResponse.json({ token: 'token-b', profile: MOCK_PROFILE_B }),
      ),
    )

    await user.click(screen.getByRole('button', { name: /changer de profil/i }))
    await user.click(screen.getByText(MOCK_PROFILE_B.name))

    await waitFor(() => expect(localStorage.getItem('iptvflix_last_profile_id')).toBe(MOCK_PROFILE_B.id))
  })

  it('Escape closes the popover', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /changer de profil/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('shows Gérer les profils link in popover', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /changer de profil/i }))

    expect(screen.getByText('Gérer les profils')).toBeInTheDocument()
    expect(screen.getByText('Se déconnecter')).toBeInTheDocument()
  })
})
