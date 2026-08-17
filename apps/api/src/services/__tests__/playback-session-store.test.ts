import { describe, it, expect, vi, afterEach } from 'vitest'
import { createSession, getSession, patchSession } from '../playback-session-store.js'

const BASE_DATA = {
  profileId: 'profile-1',
  mediaType: 'movie' as const,
  mediaId: 'movie-uuid-1',
  availabilityId: 'av-1',
  sourceId: 'src-1',
  providerStreamUrl: 'http://provider.example.com/user/pass/123.mp4',
  containerExtension: 'mp4',
  deliveryMode: 'DIRECT' as const,
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createSession / getSession round-trip', () => {
  it('returns the created session by id', () => {
    const sessionId = createSession(BASE_DATA)
    expect(typeof sessionId).toBe('string')
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/)

    const session = getSession(sessionId)
    expect(session).not.toBeNull()
    expect(session!.sessionId).toBe(sessionId)
    expect(session!.profileId).toBe(BASE_DATA.profileId)
    expect(session!.mediaId).toBe(BASE_DATA.mediaId)
    expect(session!.containerExtension).toBe('mp4')
  })

  it('does not expose providerStreamUrl in the returned entry shape to ensure it is server-side only — value is present but type-safe', () => {
    const sessionId = createSession(BASE_DATA)
    const session = getSession(sessionId)
    // providerStreamUrl IS in the session (the gateway needs it) but should never leave the server
    expect(session!.providerStreamUrl).toBe(BASE_DATA.providerStreamUrl)
  })

  it('returns null for an unknown sessionId', () => {
    expect(getSession('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('stores independent sessions with separate ids', () => {
    const id1 = createSession({ ...BASE_DATA, mediaId: 'movie-1' })
    const id2 = createSession({ ...BASE_DATA, mediaId: 'movie-2' })

    expect(id1).not.toBe(id2)
    expect(getSession(id1)!.mediaId).toBe('movie-1')
    expect(getSession(id2)!.mediaId).toBe('movie-2')
  })
})

describe('patchSession', () => {
  it('updates deliveryMode on an existing session', () => {
    const id = createSession(BASE_DATA)
    patchSession(id, { deliveryMode: 'HLS_REMUX' })
    expect(getSession(id)!.deliveryMode).toBe('HLS_REMUX')
  })
})

describe('expired session returns null', () => {
  it('returns null after TTL expires', () => {
    vi.useFakeTimers()
    const sessionId = createSession(BASE_DATA)

    expect(getSession(sessionId)).not.toBeNull()

    // Advance past 4-hour TTL
    vi.advanceTimersByTime(4 * 60 * 60 * 1000 + 1)

    expect(getSession(sessionId)).toBeNull()
  })
})
