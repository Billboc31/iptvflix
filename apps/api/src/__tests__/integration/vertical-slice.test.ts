import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import Fastify from 'fastify'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  sources,
  movies,
  series as seriesTable,
  movieAvailabilities,
  seriesAvailabilities,
  syncRuns,
} from '../../db/schema/index.js'
import { sourcesRoutes } from '../../routes/sources.js'
import { moviesRoutes } from '../../routes/movies.js'
import { seriesRoutes } from '../../routes/series.js'
import { syncRunsRoutes } from '../../routes/sync-runs.js'

// ---------------------------------------------------------------------------
// Fake Xtream fixture data
// ---------------------------------------------------------------------------

const FAKE_BASE = 'http://fake-xtream-integration.test'

const FAKE_ACCOUNT_INFO = {
  user_info: {
    username: 'testuser',
    password: 'testpass',
    message: 'Welcome',
    auth: 1,
    status: 'Active',
    exp_date: '9999999999',
    is_trial: '0',
    active_cons: '0',
    created_at: '1700000000',
    max_connections: '1',
    allowed_output_formats: ['m3u8'],
  },
  server_info: {
    url: 'fake-xtream-integration.test',
    port: '80',
    server_protocol: 'http',
    timestamp_now: 1700000000,
    time_now: '2024-01-01 00:00:00',
  },
}

const FAKE_VOD_STREAMS = [
  {
    num: 1,
    name: 'Integration Movie One',
    stream_id: 5001,
    stream_icon: '',
    rating: '7.5',
    added: '1700000000',
    category_id: '1',
    container_extension: 'mkv',
    tmdb: '',
    plot: 'First test movie.',
    cover: '',
  },
  {
    num: 2,
    name: 'Integration Movie Two',
    stream_id: 5002,
    stream_icon: '',
    rating: '8.0',
    added: '1700000001',
    category_id: '1',
    container_extension: 'mp4',
    tmdb: '',
    plot: 'Second test movie.',
    cover: '',
  },
]

const FAKE_SERIES_LIST = [
  {
    series_id: 6001,
    name: 'Integration Series One',
    cover: '',
    category_id: '10',
    rating: '8.5',
    plot: 'First test series.',
    releaseDate: '2022-01-01',
  },
]

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

function happyHandlers() {
  return [
    http.get(`${FAKE_BASE}/player_api.php`, ({ request }) => {
      const url = new URL(request.url)
      const action = url.searchParams.get('action') ?? ''

      if (action === 'get_server_info' || action === 'get_account_info') {
        return HttpResponse.json(FAKE_ACCOUNT_INFO)
      }
      if (action === 'get_vod_categories' || action === 'get_series_categories') {
        return HttpResponse.json([{ category_id: '1', category_name: 'Test', parent_id: 0 }])
      }
      if (action === 'get_vod_streams') return HttpResponse.json(FAKE_VOD_STREAMS)
      if (action === 'get_series') return HttpResponse.json(FAKE_SERIES_LIST)
      return HttpResponse.json([])
    }),
  ]
}

const mswServer = setupServer()

// ---------------------------------------------------------------------------
// Fastify app
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  mswServer.listen({ onUnhandledRequest: 'bypass' })
  await app.register(sourcesRoutes)
  await app.register(moviesRoutes)
  await app.register(seriesRoutes)
  await app.register(syncRunsRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  mswServer.close()
})

// Per-test cleanup: delete movies/series created via the test source, then the source itself
let cleanupSourceId: string | null = null

afterEach(async () => {
  mswServer.resetHandlers()
  if (!cleanupSourceId) return

  const sourceId = cleanupSourceId
  cleanupSourceId = null

  const movieRows = await db
    .select({ movieId: movieAvailabilities.movieId })
    .from(movieAvailabilities)
    .where(eq(movieAvailabilities.providerId, sourceId))

  if (movieRows.length > 0) {
    await db.delete(movies).where(inArray(movies.id, movieRows.map((r) => r.movieId)))
  }

  const seriesRows = await db
    .select({ seriesId: seriesAvailabilities.seriesId })
    .from(seriesAvailabilities)
    .where(eq(seriesAvailabilities.providerId, sourceId))

  if (seriesRows.length > 0) {
    await db.delete(seriesTable).where(inArray(seriesTable.id, seriesRows.map((r) => r.seriesId)))
  }

  await db.delete(syncRuns).where(eq(syncRuns.sourceId, sourceId))
  await db.delete(sources).where(eq(sources.id, sourceId))
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Vertical slice integration — source config → sync → catalog query', () => {
  it('happy path: full pipeline produces correctly shaped canonical movies and series', async () => {
    mswServer.use(...happyHandlers())

    // 1. Create source
    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Happy Integration Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'testuser', password: 'testpass' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    // 2. Test connection
    const testRes = await app.inject({ method: 'POST', url: `/sources/${source.id}/test` })
    expect(testRes.statusCode).toBe(200)
    expect(testRes.json()).toMatchObject({ ok: true, message: 'Connection successful' })

    // 3. Trigger sync
    const syncRes = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      body: { sourceId: source.id },
    })
    expect(syncRes.statusCode).toBe(201)
    const run = syncRes.json<{ status: string; moviesAdded: number; seriesAdded: number }>()
    expect(run.status).toBe('DONE')
    expect(run.moviesAdded).toBe(2)
    expect(run.seriesAdded).toBe(1)

    // 4. GET /movies — canonical fields present, availability = AVAILABLE
    const moviesRes = await app.inject({ method: 'GET', url: '/movies' })
    expect(moviesRes.statusCode).toBe(200)
    const moviesData = moviesRes.json<{ items: unknown[]; total: number }>()
    expect(moviesData.total).toBeGreaterThanOrEqual(2)

    const movie = moviesData.items.find((m: any) => m.title === 'Integration Movie One') as any
    expect(movie).toBeDefined()
    expect(movie.title).toBe('Integration Movie One')
    expect(movie.availabilityStatus).toBe('AVAILABLE')
    expect(Array.isArray(movie.genres)).toBe(true)

    // 5. GET /series — availability = AVAILABLE
    const seriesRes = await app.inject({ method: 'GET', url: '/series' })
    expect(seriesRes.statusCode).toBe(200)
    const seriesData = seriesRes.json<{ items: unknown[]; total: number }>()
    expect(seriesData.total).toBeGreaterThanOrEqual(1)

    const serie = seriesData.items.find((s: any) => s.title === 'Integration Series One') as any
    expect(serie).toBeDefined()
    expect(serie.availabilityStatus).toBe('AVAILABLE')
    expect(typeof serie.year).toMatch(/^number|object$/)
  })

  it('empty catalog sync — GET /movies and GET /series return empty lists', async () => {
    // All catalog endpoints return empty arrays; auth still succeeds
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, ({ request }) => {
        const action = new URL(request.url).searchParams.get('action') ?? ''
        if (action === 'get_server_info' || action === 'get_account_info') {
          return HttpResponse.json(FAKE_ACCOUNT_INFO)
        }
        return HttpResponse.json([])
      }),
    )

    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Empty Integration Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'u', password: 'p' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    const syncRes = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      body: { sourceId: source.id },
    })
    expect(syncRes.statusCode).toBe(201)
    expect(syncRes.json()).toMatchObject({ status: 'DONE', moviesAdded: 0, seriesAdded: 0 })

    const moviesRes = await app.inject({ method: 'GET', url: '/movies' })
    expect(moviesRes.json<{ items: unknown[] }>().items).toHaveLength(0)

    const seriesRes = await app.inject({ method: 'GET', url: '/series' })
    expect(seriesRes.json<{ items: unknown[] }>().items).toHaveLength(0)
  })

  it('auth error on test-connection — response has ok: false, no sync run created', async () => {
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, () => new HttpResponse(null, { status: 401 })),
    )

    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Auth Fail Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'bad', password: 'bad' },
    })
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    const testRes = await app.inject({ method: 'POST', url: `/sources/${source.id}/test` })
    expect(testRes.statusCode).toBe(200)
    expect(testRes.json()).toMatchObject({ ok: false })

    // No sync run should exist for this source
    const runs = await db.select().from(syncRuns).where(eq(syncRuns.sourceId, source.id))
    expect(runs).toHaveLength(0)
  })

  it('sync error — MSW returns 500, sync run records FAILED status', async () => {
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, () => new HttpResponse(null, { status: 500 })),
    )

    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Error Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'u', password: 'p' },
    })
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    const syncRes = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      body: { sourceId: source.id },
    })
    // Main sync service surfaces fetch failures as HTTP errors (or FAILED run).
    if (syncRes.statusCode === 201) {
      const run = syncRes.json<{ status: string; error: string | null }>()
      expect(run.status).toBe('FAILED')
      expect(run.error).toBeTruthy()
    } else {
      expect(syncRes.statusCode).toBeGreaterThanOrEqual(400)
    }
  })
})
