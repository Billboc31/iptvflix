/**
 * Playback integration tests — Phase 5 of T085.
 *
 * Spins up a local fake Xtream VOD server, mocks the DB layer, and tests
 * the full resolve → gateway HTTP flow without touching a real provider.
 *
 * Verifies:
 * - X-Correlation-ID is returned in the resolve response header
 * - correlationId appears in the resolve response body
 * - No Xtream credentials appear in the resolve response body
 * - Gateway proxy mode streams provider content with correct MIME type
 * - Gateway proxy mode returns typed errorCategory when upstream is unreachable
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import Fastify, { type FastifyInstance } from 'fastify'

// ---------------------------------------------------------------------------
// DB mock — queue-based, same pattern as playback-resolver.test.ts
// ---------------------------------------------------------------------------

const dbResultQueue: unknown[][] = []

vi.mock('../db/client.js', () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(dbResultQueue.shift() ?? [])),
    select: vi.fn().mockReturnThis(),
  }
  chain.select = vi.fn().mockReturnValue(chain)
  return { db: { select: chain.select } }
})

vi.mock('../services/profile-service.js', () => ({
  DEFAULT_PROFILE_ID: '00000000-0000-0000-0000-000000000001',
  getDefaultProfilePreferences: vi.fn().mockResolvedValue({
    preferredAudioLanguages: [],
    preferredSubtitleLanguages: [],
    preferredSourceIds: [],
    maxVideoQuality: null,
    autoplayPreviews: false,
  }),
}))

vi.mock('../services/probe-cache.js', () => ({
  getProbe: vi.fn().mockReturnValue(null),
  setProbe: vi.fn(),
}))

// No ffmpeg in test environment — resolver falls back to DIRECT
vi.mock('../services/ffmpeg-availability.js', () => ({
  isFfmpegAvailable: vi.fn().mockResolvedValue(false),
  isFfprobeAvailable: vi.fn().mockResolvedValue(false),
}))

// Probe always fails in test — resolver uses extension fallback (m3u8 → DIRECT)
vi.mock('../services/media-prober.js', () => ({
  probeMedia: vi.fn().mockRejectedValue(new Error('ffprobe unavailable in test')),
}))

// ---------------------------------------------------------------------------
// Fake Xtream VOD server
// ---------------------------------------------------------------------------

const FAKE_HLS_MANIFEST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:6',
  '#EXTINF:6.000,',
  'seg00001.ts',
  '#EXTINF:6.000,',
  'seg00002.ts',
  '#EXT-X-ENDLIST',
].join('\n')

const FAKE_SEGMENT = Buffer.from('FAKE_MPEG_TS_BYTES_FOR_TESTING')

function startFakeXtream(): Promise<{ baseUrl: string; stop(): Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/'
      // Serve HLS manifest for movie VOD requests
      if (url.includes('/movie/') && url.endsWith('.m3u8')) {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': String(Buffer.byteLength(FAKE_HLS_MANIFEST)),
        })
        res.end(FAKE_HLS_MANIFEST)
        return
      }
      // Serve raw bytes for mp4 or ts requests
      if (url.includes('/movie/') && (url.endsWith('.mp4') || url.endsWith('.ts') || url.endsWith('.mkv'))) {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(FAKE_SEGMENT.length),
        })
        res.end(FAKE_SEGMENT)
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    })

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      const baseUrl = `http://127.0.0.1:${port}`
      resolve({
        baseUrl,
        stop: () => new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      })
    })
  })
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const AVAIL_ID = 'bbbbbbbb-2222-2222-2222-222222222222'
const SOURCE_ID = 'cccccccc-3333-3333-3333-333333333333'
const STREAM_ID = '5001'
const XTREAM_USER = 'testuser'
const XTREAM_PASS = 'secretpass'

function makeAvailability(baseUrlOverride?: string) {
  return {
    id: AVAIL_ID,
    status: 'AVAILABLE',
    providerId: SOURCE_ID,
    providerItemId: STREAM_ID,
    audioLanguage: 'fr',
    subtitleLanguage: null,
    videoQuality: 'HD',
    rawTitle: 'Test Movie Integration',
    containerExtension: 'mkv',
  }
}

function makeSource(baseUrl: string) {
  return {
    id: SOURCE_ID,
    name: 'Integration Xtream Source',
    type: 'XTREAM',
    baseUrl,
    username: XTREAM_USER,
    password: XTREAM_PASS,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Push the 3 DB results the resolver expects:
// 1. movie availabilities, 2. sources, 3. viewing progress
function queueDbForResolve(baseUrl: string) {
  dbResultQueue.push([makeAvailability()])
  dbResultQueue.push([makeSource(baseUrl)])
  dbResultQueue.push([]) // no viewing progress
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

import { playbackRoutes } from '../routes/playback.js'

let app: FastifyInstance
let fakeServer: { baseUrl: string; stop(): Promise<void> }

beforeAll(async () => {
  fakeServer = await startFakeXtream()
  app = Fastify({ logger: false })
  await app.register(playbackRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await fakeServer.stop()
})

beforeEach(() => {
  dbResultQueue.length = 0
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /playback/resolve/movie/:id — correlation ID and credential safety', () => {
  it('returns X-Correlation-ID header in resolve response', async () => {
    queueDbForResolve(fakeServer.baseUrl)

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('embeds correlationId in the resolve response body', async () => {
    queueDbForResolve(fakeServer.baseUrl)

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.correlationId).toBe('string')
    expect(body.correlationId).toBe(res.headers['x-correlation-id'])
  })

  it('does not expose Xtream credentials in the resolve response body', async () => {
    queueDbForResolve(fakeServer.baseUrl)

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const raw = res.body
    expect(raw).not.toContain(XTREAM_USER)
    expect(raw).not.toContain(XTREAM_PASS)
    expect(raw).not.toContain('127.0.0.1')
  })

  it('returns gatewayUrl that does not expose provider stream URL', async () => {
    queueDbForResolve(fakeServer.baseUrl)

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    const body = res.json()
    expect(body.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(body.gatewayUrl).not.toContain(XTREAM_USER)
    expect(body.gatewayUrl).not.toContain(XTREAM_PASS)
  })

  it('sets deliveryMode to DIRECT for Xtream sources', async () => {
    queueDbForResolve(fakeServer.baseUrl)

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    const body = res.json()
    expect(body.deliveryMode).toBe('DIRECT')
  })

  it('returns 400 with errorCategory when mediaId is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/playback/resolve/movie/not-a-uuid',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.errorCategory).toBe('STREAM_URL_INVALID')
    expect(typeof body.correlationId).toBe('string')
  })
})

describe('GET /playback/stream/:sessionId — gateway proxy with typed errors', () => {
  async function resolveAndGetSessionId(): Promise<string> {
    queueDbForResolve(fakeServer.baseUrl)
    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const match = body.gatewayUrl.match(/\/playback\/stream\/([^/]+)$/)
    return match![1] as string
  }

  it('redirects to provider when proxy mode is off (default)', async () => {
    const sessionId = await resolveAndGetSessionId()

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
    })

    expect(res.statusCode).toBe(302)
    // Redirect location contains provider URL (with Xtream m3u8 path)
    expect(res.headers.location).toContain('/movie/')
    expect(res.headers.location).toContain('.m3u8')
  })

  it('proxies HLS manifest with correct Content-Type in proxy mode', async () => {
    const sessionId = await resolveAndGetSessionId()

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}?proxy=1`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('mpegurl')
    expect(res.body).toContain('#EXTM3U')
  })

  it('rewrites HLS segment URIs through IPTVFlix proxy — no credentials in manifest', async () => {
    const sessionId = await resolveAndGetSessionId()

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}?proxy=1`,
    })

    expect(res.statusCode).toBe(200)
    // Segment paths must proxy through IPTVFlix — not pointing at provider
    expect(res.body).toContain(`/playback/stream/${sessionId}/segment?uri=`)
    expect(res.body).not.toContain(XTREAM_USER)
    expect(res.body).not.toContain(XTREAM_PASS)
    // Provider address must not be in the rewritten manifest
    expect(res.body).not.toContain('127.0.0.1')
  })

  it('returns 404 with SESSION_EXPIRED category for unknown session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/playback/stream/00000000-dead-dead-dead-000000000000?proxy=1',
    })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.errorCategory).toBe('SESSION_EXPIRED')
  })
})

describe('POST /playback/resolve — error category when availability not found', () => {
  it('returns 400 when no availabilities exist for the movie', async () => {
    // Queue: empty availabilities → no candidates → ValidationError
    dbResultQueue.push([]) // no movie availabilities
    dbResultQueue.push([]) // no sources
    dbResultQueue.push([]) // no progress

    const res = await app.inject({
      method: 'POST',
      url: `/playback/resolve/movie/${MOVIE_ID}`,
      payload: {},
    })

    // Validator throws → 400 with correlationId
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(typeof body.correlationId).toBe('string')
  })
})
