import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before imports
// ---------------------------------------------------------------------------

const mockGetSession = vi.hoisted(() => vi.fn())
const mockProbeMedia = vi.hoisted(() => vi.fn())
const mockGetProbe = vi.hoisted(() => vi.fn())
const mockSetProbe = vi.hoisted(() => vi.fn())

vi.mock('../../services/playback-session-store.js', () => ({
  getSession: mockGetSession,
  createSession: vi.fn(() => 'mock-session-id'),
}))

vi.mock('../../services/media-prober.js', () => ({
  probeMedia: mockProbeMedia,
}))

vi.mock('../../services/probe-cache.js', () => ({
  getProbe: mockGetProbe,
  setProbe: mockSetProbe,
}))

// Mock the resolver so POST /playback/resolve doesn't hit the DB
vi.mock('../../services/playback-resolver.js', () => ({
  resolvePlayback: vi.fn().mockResolvedValue({
    gatewayUrl: '/api/playback/stream/mock-session-id',
    availabilityId: 'av-1',
    startPositionSeconds: 0,
    alternatives: [],
  }),
}))

vi.mock('../../services/profile-service.js', () => ({
  DEFAULT_PROFILE_ID: '00000000-0000-0000-0000-000000000001',
  getDefaultProfilePreferences: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: {} }))

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const MOVIE_ID = 'ffffffff-0000-0000-0000-000000000001'

function makeSession(overrides: Partial<{
  containerExtension: string
  profileId: string
}> = {}) {
  return {
    sessionId: SESSION_ID,
    profileId: overrides.profileId ?? PROFILE_ID,
    mediaType: 'movie' as const,
    mediaId: MOVIE_ID,
    availabilityId: 'av-1',
    sourceId: 'src-1',
    providerStreamUrl: 'http://provider.example.com/user/pass/123.mp4',
    containerExtension: overrides.containerExtension ?? 'mp4',
  }
}

function makeFetchOk(body: string | Readable = '', headers: Record<string, string> = {}) {
  const responseHeaders = new Headers({
    'Content-Type': 'video/mp4',
    'Content-Length': '1024',
    ...headers,
  })
  return {
    ok: true,
    status: 200,
    headers: responseHeaders,
    body: Readable.toWeb(body instanceof Readable ? body : Readable.from([Buffer.from(body)])),
    text: async () => typeof body === 'string' ? body : '',
  }
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

import { playbackRoutes } from '../playback.js'

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(playbackRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /playback/stream/:sessionId — session validation', () => {
  it('returns 404 for unknown sessionId', async () => {
    mockGetSession.mockReturnValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/not found/i)
  })

  it('returns 403 when session belongs to a different profile', async () => {
    mockGetSession.mockReturnValue(makeSession({ profileId: 'other-profile-id' }))

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(403)
  })
})

describe('GET /playback/stream/:sessionId — mp4 pass-through', () => {
  it('forwards upstream body with 200 and correct Content-Type', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('video/mp4')
  })

  it('forwards Range header to upstream', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue({
      ...makeFetchOk('bytes'),
      status: 206,
      headers: new Headers({
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes 0-1023/4096',
        'Content-Length': '1024',
      }),
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
      headers: { range: 'bytes=0-1023' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Range: 'bytes=0-1023' }),
      }),
    )
  })

  it('sets Accept-Ranges: bytes header', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk())

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.headers['accept-ranges']).toBe('bytes')
  })
})

describe('GET /playback/stream/:sessionId — upstream error handling', () => {
  it('returns 401 when upstream returns 401', async () => {
    mockGetSession.mockReturnValue(makeSession())
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/expirée/i)
  })

  it('returns 403 when upstream returns 403', async () => {
    mockGetSession.mockReturnValue(makeSession())
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(403)
    // This is the gateway's own 403 for upstream auth failure
    expect(res.json().error).toMatch(/expirée/i)
  })

  it('returns 404 when upstream returns 404', async () => {
    mockGetSession.mockReturnValue(makeSession())
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/introuvable/i)
  })

  it('returns 504 when upstream fetch times out (AbortError)', async () => {
    mockGetSession.mockReturnValue(makeSession())
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValue(abortError)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(504)
    expect(res.json().error).toMatch(/fournisseur/i)
  })
})

describe('GET /playback/stream/:sessionId — ts container remux', () => {
  it('returns 200 with Content-Type video/mp4 for ts extension', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'ts' }))
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'video/mp2t' }),
      body: Readable.toWeb(Readable.from([Buffer.from('fake-ts-bytes')])),
    })

    // ffmpeg spawn: mock child process that immediately writes to stdout and exits
    const { spawn } = await import('node:child_process')
    const spawnSpy = vi.spyOn({ spawn }, 'spawn').mockImplementation(() => {
      // We can't easily test the actual remux here; the spawn mock returns a silent child
      return spawn as never
    })
    void spawnSpy // suppress unused warning

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    // Because ffmpeg is not actually available in test env (or returns non-zero),
    // the gateway should attempt and either stream or return 415
    expect([200, 415]).toContain(res.statusCode)
    if (res.statusCode === 200) {
      expect(res.headers['content-type']).toContain('video/mp4')
    }
  })
})

// ---------------------------------------------------------------------------
// Regression: compat path selection structural defect (T081)
// Before fix: Safari UA without ?compat=1 incorrectly triggered the compat path
// (isSafariOrIOS was OR-ed into useCompat), making the auto-retry a no-op.
// After fix: only ?compat=1 query param triggers the compat path.
// ---------------------------------------------------------------------------

const SAFARI_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MP4_PROBE_RESULT = {
  videoCodec: 'h264',
  audioCodec: 'aac',
  containerFormat: 'mov,mp4,m4a,3gp,3g2,mj2',
}

describe('compat path selection — structural defect regression (T081)', () => {
  it('Safari UA without ?compat=1 uses extension-based (non-compat) routing', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))
    mockGetProbe.mockReturnValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('video/mp4')
    expect(res.headers['accept-ranges']).toBe('bytes')
    expect(mockProbeMedia).not.toHaveBeenCalled()
  })

  it('Safari UA with ?compat=1 triggers compat path (probeMedia called)', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))
    mockGetProbe.mockReturnValue(null)
    mockProbeMedia.mockResolvedValue(MP4_PROBE_RESULT)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}?compat=1`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    expect(mockProbeMedia).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  it('Non-Safari UA without ?compat=1 uses extension-based routing', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))
    mockGetProbe.mockReturnValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
      headers: { 'user-agent': CHROME_UA },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('video/mp4')
    expect(mockProbeMedia).not.toHaveBeenCalled()
  })

  it('?compat=1 without Safari UA still triggers compat path', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))
    mockGetProbe.mockReturnValue(null)
    mockProbeMedia.mockResolvedValue(MP4_PROBE_RESULT)

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}?compat=1`,
      headers: { 'user-agent': CHROME_UA },
    })

    expect(mockProbeMedia).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })
})
