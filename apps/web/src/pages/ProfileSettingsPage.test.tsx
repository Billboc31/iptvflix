import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import ProfileSettingsPage from './ProfileSettingsPage.js'
import type { ProfileResponse } from '@iptvflix/api-contracts'

const MOCK_PROFILE: ProfileResponse = {
  id: 'profile-1',
  name: 'Default',
  preferences: {
    preferredAudioLanguages: ['en'],
    preferredSubtitleLanguages: ['fr'],
    preferredSourceIds: [],
    maxVideoQuality: null,
  },
}

describe('ProfileSettingsPage', () => {
  it('renders preferred audio and subtitle language preferences loaded from profile API', async () => {
    server.use(
      http.get('/api/profile', () => HttpResponse.json(MOCK_PROFILE)),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('en')).toBeInTheDocument()
    })
    expect(screen.getByText('fr')).toBeInTheDocument()
  })

  it('shows language preferences from API regardless of navigator.language', async () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('de')
    server.use(
      http.get('/api/profile', () => HttpResponse.json(MOCK_PROFILE)),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('en')).toBeInTheDocument()
    })
    expect(screen.getByText('fr')).toBeInTheDocument()
    expect(screen.queryByText('de')).not.toBeInTheDocument()
  })

  it('submitting the form sends PATCH /profile/preferences with the current preferences', async () => {
    const user = userEvent.setup()
    let capturedBody: unknown = null
    server.use(
      http.get('/api/profile', () => HttpResponse.json(MOCK_PROFILE)),
      http.patch('/api/profile/preferences', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(MOCK_PROFILE)
      }),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(capturedBody).toEqual({
        preferredAudioLanguages: ['en'],
        preferredSubtitleLanguages: ['fr'],
        preferredSourceIds: [],
        maxVideoQuality: null,
      })
    })
  })
})
