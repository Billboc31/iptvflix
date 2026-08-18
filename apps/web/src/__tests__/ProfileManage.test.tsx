import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../test/handlers.js'
import { ProfileProvider } from '../context/ProfileContext.js'
import { MOCK_PROFILE_A, MOCK_PROFILE_B, MOCK_PROFILE_KIDS, MOCK_SELECT_PROFILE_RESPONSE } from '../test/handlers.js'
import ProfileManagePage from '../pages/ProfileManagePage.js'

function renderManage() {
  return render(
    <MemoryRouter initialEntries={['/profiles']}>
      <ProfileProvider>
        <ProfileManagePage />
      </ProfileProvider>
    </MemoryRouter>,
  )
}

describe('ProfileManagePage', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('iptvflix_last_profile_id', MOCK_PROFILE_A.id)
    server.use(
      http.post('/api/profiles/:id/select', () =>
        HttpResponse.json(MOCK_SELECT_PROFILE_RESPONSE),
      ),
    )
  })

  it('lists all profiles after load', async () => {
    renderManage()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())
    expect(screen.getByText(MOCK_PROFILE_B.name)).toBeInTheDocument()
    expect(screen.getByText(MOCK_PROFILE_KIDS.name)).toBeInTheDocument()
  })

  it('shows Kids badge for kids profile', async () => {
    renderManage()
    await waitFor(() => expect(screen.queryAllByText('Kids').length).toBeGreaterThan(0))
  })

  it('delete button is disabled when only one profile exists', async () => {
    server.use(
      http.get('/api/profiles', () => HttpResponse.json([MOCK_PROFILE_A])),
    )
    renderManage()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i })
    deleteButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('shows 409 error message when delete is blocked by API', async () => {
    server.use(
      http.delete('/api/profiles/:id', () =>
        HttpResponse.json({ error: 'Cannot delete the last profile' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderManage()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i })
    await user.click(deleteButtons[0])

    await waitFor(() =>
      expect(screen.queryByText(/cannot delete the last profile/i)).toBeInTheDocument(),
    )
  })

  it('Ajouter button is shown with multiple profiles', async () => {
    renderManage()
    await waitFor(() => expect(screen.queryByText(MOCK_PROFILE_A.name)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeInTheDocument()
  })

  it('Ajouter button is disabled and limit message shown when at 5 profiles', async () => {
    const profiles = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_PROFILE_A,
      id: `profile-${i}`,
      name: `Profile ${i + 1}`,
    }))
    server.use(
      http.get('/api/profiles', () => HttpResponse.json(profiles)),
    )
    renderManage()
    await waitFor(() => expect(screen.queryByText('Profile 1')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled()
    expect(screen.getByText(/limite de 5 profils/i)).toBeInTheDocument()
  })
})
