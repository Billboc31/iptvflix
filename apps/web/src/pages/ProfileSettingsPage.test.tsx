import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import ProfileSettingsPage from './ProfileSettingsPage.js'
import type { ProfileResponse, SourceResponse } from '@iptvflix/api-contracts'

const MOCK_SOURCES: SourceResponse[] = [
  {
    id: 'src-a',
    name: 'Xtream HD',
    type: 'XTREAM',
    baseUrl: 'http://xtream.example.com',
    username: 'user',
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'src-b',
    name: 'Plex Home',
    type: 'PLEX',
    baseUrl: 'http://plex.example.com',
    username: null,
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

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

  it('renders source names from preferredSourceIds in priority order', async () => {
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          ...MOCK_PROFILE,
          preferences: { ...MOCK_PROFILE.preferences, preferredSourceIds: ['src-a', 'src-b'] },
        }),
      ),
      http.get('/api/sources', () => HttpResponse.json(MOCK_SOURCES)),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Xtream HD')).toBeInTheDocument()
    })
    expect(screen.getByText('Plex Home')).toBeInTheDocument()
  })

  it('moves a source down and updates the display order', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          ...MOCK_PROFILE,
          preferences: { ...MOCK_PROFILE.preferences, preferredSourceIds: ['src-a', 'src-b'] },
        }),
      ),
      http.get('/api/sources', () => HttpResponse.json(MOCK_SOURCES)),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Xtream HD')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Descendre Xtream HD' }))
    const items = screen.getAllByRole('listitem')
    const xtreamIdx = items.findIndex((el) => el.textContent?.includes('Xtream HD'))
    const plexIdx = items.findIndex((el) => el.textContent?.includes('Plex Home'))
    expect(plexIdx).toBeLessThan(xtreamIdx)
  })

  it('submitting the form sends preferredSourceIds in the reordered order', async () => {
    const user = userEvent.setup()
    let capturedBody: unknown = null
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          ...MOCK_PROFILE,
          preferences: { ...MOCK_PROFILE.preferences, preferredSourceIds: ['src-a', 'src-b'] },
        }),
      ),
      http.get('/api/sources', () => HttpResponse.json(MOCK_SOURCES)),
      http.patch('/api/profile/preferences', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(MOCK_PROFILE)
      }),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Xtream HD')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Descendre Xtream HD' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect((capturedBody as { preferredSourceIds: string[] }).preferredSourceIds).toEqual(['src-b', 'src-a'])
    })
  })

  it('does not render stale source ids and excludes them from the save payload', async () => {
    const user = userEvent.setup()
    let capturedBody: unknown = null
    server.use(
      http.get('/api/profile', () =>
        HttpResponse.json({
          ...MOCK_PROFILE,
          preferences: { ...MOCK_PROFILE.preferences, preferredSourceIds: ['deleted-id'] },
        }),
      ),
      http.get('/api/sources', () => HttpResponse.json(MOCK_SOURCES)),
      http.patch('/api/profile/preferences', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(MOCK_PROFILE)
      }),
    )
    render(<ProfileSettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
    })
    expect(screen.queryByText('deleted-id')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect((capturedBody as { preferredSourceIds: string[] }).preferredSourceIds).toEqual([])
    })
  })
})
