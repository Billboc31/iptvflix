import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import { ProfileProvider, useProfile } from '../context/ProfileContext.js'
import { MOCK_PROFILE_A, MOCK_PROFILE_B, MOCK_SELECT_PROFILE_RESPONSE } from '../test/handlers.js'

const LAST_PROFILE_KEY = 'iptvflix_last_profile_id'
const AUTH_TOKEN_KEY = 'iptvflix_auth_token'

function wrapper({ children }: { children: React.ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>
}

describe('ProfileContext', () => {
  beforeEach(() => {
    localStorage.clear()
    server.resetHandlers()
  })

  it('loads profiles on mount and auto-selects last-used profile', async () => {
    localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_A.id)

    const { result } = renderHook(() => useProfile(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.profiles).toHaveLength(3)
    expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_A.id)
  })

  it('leaves currentProfile null when no last-used profile', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.currentProfile).toBeNull()
    expect(result.current.profiles).toHaveLength(3)
  })

  it('selectProfile stores new token and updates currentProfile', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.selectProfile(MOCK_PROFILE_A.id)
    })

    expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_A.id)
    expect(localStorage.getItem(LAST_PROFILE_KEY)).toBe(MOCK_PROFILE_A.id)
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(MOCK_SELECT_PROFILE_RESPONSE.token)
  })

  it('profileVersion increments on each selectProfile call', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const initialVersion = result.current.profileVersion

    await act(async () => { await result.current.selectProfile(MOCK_PROFILE_A.id) })
    const v1 = result.current.profileVersion

    server.use(
      http.post('/api/profiles/:id/select', () =>
        HttpResponse.json({ token: 'new-token', profile: MOCK_PROFILE_B }),
      ),
    )
    await act(async () => { await result.current.selectProfile(MOCK_PROFILE_B.id) })
    const v2 = result.current.profileVersion

    expect(v1).toBeGreaterThan(initialVersion)
    expect(v2).toBeGreaterThan(v1)
  })

  it('lastUsedProfileId is restored on remount', async () => {
    localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_B.id)
    server.use(
      http.post('/api/profiles/:id/select', () =>
        HttpResponse.json({ token: 'token-b', profile: MOCK_PROFILE_B }),
      ),
    )

    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.currentProfile?.id).toBe(MOCK_PROFILE_B.id)
  })

  it('failed selectProfile leaves previous profile unchanged', async () => {
    localStorage.setItem(LAST_PROFILE_KEY, MOCK_PROFILE_A.id)
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const prevProfile = result.current.currentProfile

    server.use(
      http.post('/api/profiles/:id/select', () =>
        new HttpResponse(null, { status: 500 }),
      ),
    )

    await act(async () => {
      try {
        await result.current.selectProfile(MOCK_PROFILE_B.id)
      } catch {
        // expected
      }
    })

    expect(result.current.currentProfile?.id).toBe(prevProfile?.id)
  })
})
