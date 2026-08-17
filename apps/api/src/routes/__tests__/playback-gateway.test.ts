import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import Fastify from 'fastify'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before imports
// ---------------------------------------------------------------------------

const mockGetSession = vi.hoisted(() => vi.fn())
const mockGetPlaylist = vi.hoisted(() => vi.fn())
const mockGetSegment = vi.hoisted(() => vi.fn())

vi.mock('../../services/playback-session-store.js', () => ({
  getSession: mockGetSession,
  createSession: vi.fn(() => 'mock-session-id'),
}))

vi.mock('../../services/hls-session-store.js', () => ({
  getPlaylist: mockGetPlaylist,
  getSegment: mockGetSegment,
  SEGMENT_RE: /^seg\d{5}\.ts$/,
}))

// Mock the resolver so POST /playback/resolve doesn't hit the DB
vi.mock('../../services/playback-resolver.js', () => ({
  resolvePlayback: vi.fn().mockResolvedValue({
    gatewayUrl: '/playback/stream/mock-session-id',
    deliveryMode: 'DIRECT',
    probeResult: { videoCodec: 'h264', audioCodec: 'aac', containerFormat: 'mov,mp4' },
    availabilityId: 'av-1',
    containerExtension: 'mp4',
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
  deliveryMode: 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'
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
    deliveryMode: overrides.deliveryMode ?? 'DIRECT',
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
// GET /playback/stream/:sessionId — session validation
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

// ---------------------------------------------------------------------------
// GET /playback/stream/:sessionId — DIRECT mode pass-through
// ---------------------------------------------------------------------------

describe('GET /playback/stream/:sessionId — DIRECT mp4 pass-through', () => {
  it('forwards upstream body with 200 and correct Content-Type', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4', deliveryMode: 'DIRECT' }))
    mockFetch.mockResolvedValue(makeFetchOk('fake-mp4-bytes'))

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('video/mp4')
  })

  it('forwards Range header to upstream', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4', deliveryMode: 'DIRECT' }))
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
        headers: expect.objectContaining({
          Range: 'bytes=0-1023',
          'User-Agent': expect.stringContaining('VLC'),
        }),
      }),
    )
  })

  it('sets Accept-Ranges: bytes header', async () => {
    mockGetSession.mockReturnValue(makeSession({ containerExtension: 'mp4', deliveryMode: 'DIRECT' }))
    mockFetch.mockResolvedValue(makeFetchOk())

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.headers['accept-ranges']).toBe('bytes')
  })
})

// ---------------------------------------------------------------------------
// GET /playback/stream/:sessionId — HLS sessions return 409
// ---------------------------------------------------------------------------

describe('GET /playback/stream/:sessionId — HLS mode returns 409', () => {
  const HLS_MODES = ['HLS_REMUX', 'HLS_TRANSCODE_AUDIO', 'HLS_TRANSCODE_FULL'] as const

  for (const mode of HLS_MODES) {
    it(`returns 409 for session with deliveryMode ${mode}`, async () => {
      mockGetSession.mockReturnValue(makeSession({ deliveryMode: mode }))

      const res = await app.inject({
        method: 'GET',
        url: `/playback/stream/${SESSION_ID}`,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().error).toMatch(/hls/i)
    })
  }
})

// ---------------------------------------------------------------------------
// GET /playback/stream/:sessionId — upstream error handling
// ---------------------------------------------------------------------------

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

  it('retries an alternate Xtream path after upstream 404', async () => {
    mockGetSession.mockReturnValue(makeSession())
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      })
      .mockResolvedValueOnce(makeFetchOk('fake-mp4-bytes'))

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${SESSION_ID}`,
    })

    expect(res.statusCode).toBe(200)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(1)
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

// ---------------------------------------------------------------------------
// GET /playback/session/:sessionId/master.m3u8
// ---------------------------------------------------------------------------

describe('GET /playback/session/:sessionId/master.m3u8', () => {
  const PLAYLIST_URL = `/playback/session/${SESSION_ID}/master.m3u8`

  it('returns 404 for unknown playback session', async () => {
    mockGetSession.mockReturnValue(null)

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 while playlist not yet written by ffmpeg', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    mockGetPlaylist.mockResolvedValue({ status: 'not_ready' })

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })
    expect(res.statusCode).toBe(404)
  })

  it('returns 410 when HLS session has expired or failed', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    mockGetPlaylist.mockResolvedValue({ status: 'gone' })

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })
    expect(res.statusCode).toBe(410)
  })

  it('returns 200 with correct Content-Type when playlist is ready', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    mockGetPlaylist.mockResolvedValue({
      status: 'ok',
      content: '#EXTM3U\n#EXT-X-VERSION:3\n',
    })

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('mpegurl')
    expect(res.body).toContain('#EXTM3U')
  })

  it('playlist does not contain provider hostname or credentials', async () => {
    const providerUrl = 'http://provider.example.com/user/pass/123.ts'
    mockGetSession.mockReturnValue({ ...makeSession({ deliveryMode: 'HLS_REMUX' }), providerStreamUrl: providerUrl })
    const playlistContent = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXTINF:6.000,`,
      `/playback/session/${SESSION_ID}/segments/seg00001.ts`,
      '#EXT-X-ENDLIST',
    ].join('\n')
    mockGetPlaylist.mockResolvedValue({ status: 'ok', content: playlistContent })

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })

    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('provider.example.com')
    expect(res.body).not.toContain('user')
    expect(res.body).not.toContain('pass')
    // Segments must point to the IPTVFlix proxy
    expect(res.body).toContain(`/playback/session/${SESSION_ID}/segments/`)
  })

  it('segment URLs in playlist resolve to /playback/session/:id/segments/', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    const playlistContent = [
      '#EXTM3U',
      `#EXTINF:6.000,`,
      `/playback/session/${SESSION_ID}/segments/seg00001.ts`,
    ].join('\n')
    mockGetPlaylist.mockResolvedValue({ status: 'ok', content: playlistContent })

    const res = await app.inject({ method: 'GET', url: PLAYLIST_URL })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`/playback/session/${SESSION_ID}/segments/seg00001.ts`)
  })
})

// ---------------------------------------------------------------------------
// GET /playback/session/:sessionId/segments/:filename
// ---------------------------------------------------------------------------

describe('GET /playback/session/:sessionId/segments/:filename', () => {
  function segmentUrl(filename: string) {
    return `/playback/session/${SESSION_ID}/segments/${filename}`
  }

  it('returns 400 for invalid segment filename (path traversal attempt, URL-encoded)', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    // Use URL-encoded slashes so Fastify routing doesn't normalize the path away
    const res = await app.inject({ method: 'GET', url: segmentUrl('..%2F..%2F..%2Fetc%2Fpasswd') })
    // The decoded filename fails SEGMENT_RE before reaching the store — returns 400
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for filename without correct pattern', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))

    const res = await app.inject({ method: 'GET', url: segmentUrl('arbitrary.ts') })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for unknown playback session', async () => {
    mockGetSession.mockReturnValue(null)

    const res = await app.inject({ method: 'GET', url: segmentUrl('seg00001.ts') })
    expect(res.statusCode).toBe(404)
  })

  it('returns 410 when HLS session expired or failed', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    mockGetSegment.mockResolvedValue({ status: 'gone' })

    const res = await app.inject({ method: 'GET', url: segmentUrl('seg00001.ts') })
    expect(res.statusCode).toBe(410)
  })

  it('returns 404 when segment not yet written', async () => {
    mockGetSession.mockReturnValue(makeSession({ deliveryMode: 'HLS_REMUX' }))
    mockGetSegment.mockResolvedValue({ status: 'not_ready' })

    const res = await app.inject({ method: 'GET', url: segmentUrl('seg00001.ts') })
    expect(res.statusCode).toBe(404)
  })
})
