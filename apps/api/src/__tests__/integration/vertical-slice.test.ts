import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  sources,
  movies,
  series as seriesTable,
  movieAvailabilities,
  seriesAvailabilities,
  syncRuns,
  profiles,
  watchlist,
  viewingProgress,
} from '../../db/schema/index.js'
import { sourcesRoutes } from '../../routes/sources.js'
import { moviesRoutes } from '../../routes/movies.js'
import { seriesRoutes } from '../../routes/series.js'
import { catalogRoutes } from '../../routes/catalog.js'
import { syncRunsRoutes } from '../../routes/sync-runs.js'
import { searchRoutes } from '../../routes/search.js'
import { discoveryRoutes } from '../../routes/discovery.js'
import { TmdbClient } from '../../providers/metadata/tmdb/client.js'
import { ExternalDiscoveryService } from '../../services/external-discovery-service.js'

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
      if (action === 'get_series_info') {
        return HttpResponse.json({ info: { name: '', cover: '', plot: '', cast: '', director: '', genre: '', releaseDate: '', last_modified: '', rating: '0', rating_5based: 0, backdrop_path: [], youtube_trailer: '', episode_run_time: '', category_id: '1', category_name: '' }, episodes: {} })
      }
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
  await app.register(catalogRoutes)
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

    // 4. GET /movies/:id — resolve movie via availability record to avoid pagination issues
    const [movieAvailRow] = await db
      .select({ movieId: movieAvailabilities.movieId })
      .from(movieAvailabilities)
      .where(
        and(
          eq(movieAvailabilities.providerId, source.id),
          eq(movieAvailabilities.providerItemId, '5001'),
        ),
      )
    expect(movieAvailRow).toBeDefined()
    const movieRes = await app.inject({ method: 'GET', url: `/movies/${movieAvailRow.movieId}` })
    expect(movieRes.statusCode).toBe(200)
    const movie = movieRes.json<any>()
    expect(movie.title).toBe('Integration Movie One')
    expect(movie.availabilityStatus).toBe('AVAILABLE')
    expect(Array.isArray(movie.genres)).toBe(true)

    // 5. GET /series/:id — resolve series via availability record
    const [seriesAvailRow] = await db
      .select({ seriesId: seriesAvailabilities.seriesId })
      .from(seriesAvailabilities)
      .where(
        and(
          eq(seriesAvailabilities.providerId, source.id),
          eq(seriesAvailabilities.providerItemId, '6001'),
        ),
      )
    expect(seriesAvailRow).toBeDefined()
    const seriesRes = await app.inject({ method: 'GET', url: `/series/${seriesAvailRow.seriesId}` })
    expect(seriesRes.statusCode).toBe(200)
    const serie = seriesRes.json<any>()
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

    // Verify no availability records were created for this source
    const movieAvails = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.providerId, source.id))
    expect(movieAvails).toHaveLength(0)

    const seriesAvails = await db
      .select()
      .from(seriesAvailabilities)
      .where(eq(seriesAvailabilities.providerId, source.id))
    expect(seriesAvails).toHaveLength(0)
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

  it('search returns externalMovies and externalSeries arrays (empty when no discovery service)', async () => {
    mswServer.use(...happyHandlers())

    // Create and sync a source so local search has data
    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Search Base Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'testuser', password: 'testpass' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    await app.inject({ method: 'POST', url: '/sync-runs', body: { sourceId: source.id } })

    // Use a fresh app without discovery service to verify base search response shape
    const bareApp = Fastify({ logger: false })
    await bareApp.register(searchRoutes)
    await bareApp.ready()

    const res = await bareApp.inject({ method: 'GET', url: '/search?q=Integration' })
    expect(res.statusCode).toBe(200)
    const body = res.json<any>()
    expect(Array.isArray(body.movies)).toBe(true)
    expect(Array.isArray(body.series)).toBe(true)
    expect(Array.isArray(body.externalMovies)).toBe(true)
    expect(Array.isArray(body.externalSeries)).toBe(true)

    await bareApp.close()
  })

  it('source disappearance: canonical movie and user-state survive when availability is removed', async () => {
    mswServer.use(...happyHandlers())

    // 1. Create source
    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Disappearance Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'testuser', password: 'testpass' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    // 2. First sync — both movies and series ingested
    const sync1Res = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      body: { sourceId: source.id },
    })
    expect(sync1Res.statusCode).toBe(201)
    expect(sync1Res.json()).toMatchObject({ status: 'DONE', moviesAdded: 2 })

    // 3. Resolve canonical ID for stream 5001 directly from the availability record
    const [availRow] = await db
      .select({ movieId: movieAvailabilities.movieId })
      .from(movieAvailabilities)
      .where(
        and(
          eq(movieAvailabilities.providerId, source.id),
          eq(movieAvailabilities.providerItemId, '5001'),
        ),
      )
    expect(availRow).toBeDefined()
    const canonicalMovieId = availRow.movieId

    // Verify availability via /movies/:id before disappearance
    const movieBeforeRes = await app.inject({ method: 'GET', url: `/movies/${canonicalMovieId}` })
    expect(movieBeforeRes.statusCode).toBe(200)
    const movieBefore = movieBeforeRes.json<any>()
    expect(movieBefore.availabilityCount).toBe(1)
    expect(movieBefore.availabilityStatus).toBe('AVAILABLE')

    // 4. Create a profile and attach watchlist + viewing-progress entries for that movie
    const [profile] = await db.insert(profiles).values({ name: 'Test Watcher' }).returning()
    const [watchlistEntry] = await db
      .insert(watchlist)
      .values({ profileId: profile.id, mediaType: 'MOVIE', mediaId: canonicalMovieId })
      .returning()
    const [progressEntry] = await db
      .insert(viewingProgress)
      .values({
        profileId: profile.id,
        mediaType: 'MOVIE',
        mediaId: canonicalMovieId,
        progressSeconds: 300,
        durationSeconds: 7200,
      })
      .returning()

    // 5. Second sync — stream 5001 absent, only stream 5002 returned
    mswServer.resetHandlers()
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, ({ request }) => {
        const action = new URL(request.url).searchParams.get('action') ?? ''
        if (action === 'get_server_info' || action === 'get_account_info') {
          return HttpResponse.json(FAKE_ACCOUNT_INFO)
        }
        if (action === 'get_vod_categories' || action === 'get_series_categories') {
          return HttpResponse.json([{ category_id: '1', category_name: 'Test', parent_id: 0 }])
        }
        if (action === 'get_vod_streams') return HttpResponse.json([FAKE_VOD_STREAMS[1]])
        if (action === 'get_series') return HttpResponse.json(FAKE_SERIES_LIST)
        if (action === 'get_series_info') {
          return HttpResponse.json({ info: { name: '', cover: '', plot: '', cast: '', director: '', genre: '', releaseDate: '', last_modified: '', rating: '0', rating_5based: 0, backdrop_path: [], youtube_trailer: '', episode_run_time: '', category_id: '1', category_name: '' }, episodes: {} })
        }
        return HttpResponse.json([])
      }),
    )

    const sync2Res = await app.inject({
      method: 'POST',
      url: '/sync-runs',
      body: { sourceId: source.id },
    })
    expect(sync2Res.statusCode).toBe(201)
    expect(sync2Res.json()).toMatchObject({ status: 'DONE' })

    // 6. Movie is now UNAVAILABLE with availabilityCount: 0
    const movieAfterRes = await app.inject({ method: 'GET', url: `/movies/${canonicalMovieId}` })
    expect(movieAfterRes.statusCode).toBe(200)
    const movieAfter = movieAfterRes.json<any>()
    expect(movieAfter.availabilityStatus).toBe('UNAVAILABLE')
    expect(movieAfter.availabilityCount).toBe(0)

    // 7. Canonical movie row still exists in the database
    const [movieRow] = await db.select().from(movies).where(eq(movies.id, canonicalMovieId))
    expect(movieRow).toBeDefined()
    expect(movieRow.title).toBe('Integration Movie One')

    // 8. Watchlist and viewing-progress entries survive intact
    const [wl] = await db.select().from(watchlist).where(eq(watchlist.id, watchlistEntry.id))
    expect(wl).toBeDefined()
    expect(wl.mediaId).toBe(canonicalMovieId)

    const [vp] = await db.select().from(viewingProgress).where(eq(viewingProgress.id, progressEntry.id))
    expect(vp).toBeDefined()
    expect(vp.mediaId).toBe(canonicalMovieId)

    // Cleanup profile (cascades to watchlist and viewing-progress)
    await db.delete(profiles).where(eq(profiles.id, profile.id))
  })
})

// ---------------------------------------------------------------------------
// Discovery integration tests
// ---------------------------------------------------------------------------

const FAKE_TMDB_BASE = 'https://api.themoviedb.org/3'
const FAKE_TMDB_KEY = 'test-tmdb-key'

const FAKE_TMDB_SEARCH_RESULTS = {
  results: [
    {
      id: 99999,
      title: 'External Only Movie',
      release_date: '2020-01-01',
      overview: 'A movie only in TMDB.',
      poster_path: '/ext.jpg',
    },
  ],
}

const FAKE_TMDB_MOVIE_DETAIL = {
  id: 99999,
  title: 'External Only Movie',
  original_title: 'External Only Movie',
  release_date: '2020-01-01',
  overview: 'A movie only in TMDB.',
  poster_path: '/ext.jpg',
  backdrop_path: null,
  genres: [{ id: 28, name: 'Action' }],
  runtime: 120,
  imdb_id: 'tt9999999',
  popularity: 50,
  vote_average: 7.5,
  status: 'Released',
}

describe('Vertical slice — external discovery flow', () => {
  let discoveryApp!: FastifyInstance
  let discoveryService: ExternalDiscoveryService
  let materializedMovieIds: string[] = []
  let materializedSeriesIds: string[] = []

  beforeAll(async () => {
    const tmdbClient = new TmdbClient({ apiKey: FAKE_TMDB_KEY })
    discoveryService = new ExternalDiscoveryService(db, tmdbClient)

    discoveryApp = Fastify({ logger: false })
    await discoveryApp.register(searchRoutes, { discoveryService })
    await discoveryApp.register(discoveryRoutes, { discoveryService })
    await discoveryApp.register(moviesRoutes)
    await discoveryApp.register(catalogRoutes)
    await discoveryApp.ready()
  })

  afterAll(async () => {
    await discoveryApp.close()
  })

  afterEach(async () => {
    mswServer.resetHandlers()

    if (materializedMovieIds.length > 0) {
      await db.delete(movies).where(inArray(movies.id, materializedMovieIds))
      materializedMovieIds = []
    }
    if (materializedSeriesIds.length > 0) {
      await db.delete(seriesTable).where(inArray(seriesTable.id, materializedSeriesIds))
      materializedSeriesIds = []
    }
  })

  it('search with TMDB configured returns externalMovies for title not in local DB', async () => {
    mswServer.use(
      http.get(`${FAKE_TMDB_BASE}/search/movie`, () =>
        HttpResponse.json(FAKE_TMDB_SEARCH_RESULTS),
      ),
      http.get(`${FAKE_TMDB_BASE}/search/tv`, () => HttpResponse.json({ results: [] })),
    )

    const res = await discoveryApp.inject({
      method: 'GET',
      url: '/search?q=External+Only',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<any>()
    expect(body.movies).toHaveLength(0)
    expect(body.externalMovies).toHaveLength(1)
    expect(body.externalMovies[0].tmdbId).toBe('99999')
    expect(body.externalMovies[0].title).toBe('External Only Movie')
  })

  it('external result is deduplicated when same tmdbId exists in local DB', async () => {
    // Materialize the movie first so it exists locally
    mswServer.use(
      http.get(`${FAKE_TMDB_BASE}/movie/99999`, () => HttpResponse.json(FAKE_TMDB_MOVIE_DETAIL)),
      http.get(`${FAKE_TMDB_BASE}/search/movie`, () =>
        HttpResponse.json(FAKE_TMDB_SEARCH_RESULTS),
      ),
      http.get(`${FAKE_TMDB_BASE}/search/tv`, () => HttpResponse.json({ results: [] })),
    )

    const matRes = await discoveryApp.inject({
      method: 'POST',
      url: '/discovery/movies',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tmdbId: '99999' }),
    })
    expect(matRes.statusCode).toBe(200)
    const { id } = matRes.json<{ id: string }>()
    materializedMovieIds.push(id)

    // Search should now return the movie in local results and NOT in externalMovies
    const res = await discoveryApp.inject({
      method: 'GET',
      url: '/search?q=External+Only',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<any>()
    const externalTmdbIds = body.externalMovies.map((m: any) => m.tmdbId)
    expect(externalTmdbIds).not.toContain('99999')
  })

  it('POST /discovery/movies materializes a canonical movie with zero availabilities', async () => {
    mswServer.use(
      http.get(`${FAKE_TMDB_BASE}/movie/99999`, () => HttpResponse.json(FAKE_TMDB_MOVIE_DETAIL)),
    )

    const res = await discoveryApp.inject({
      method: 'POST',
      url: '/discovery/movies',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tmdbId: '99999' }),
    })
    expect(res.statusCode).toBe(200)
    const { id } = res.json<{ id: string }>()
    materializedMovieIds.push(id)

    // Verify canonical movie has zero availabilities
    const movieRes = await discoveryApp.inject({ method: 'GET', url: `/movies/${id}` })
    expect(movieRes.statusCode).toBe(200)
    const movie = movieRes.json<any>()
    expect(movie.availabilityCount).toBe(0)
    expect(movie.availabilityStatus).toBe('UNAVAILABLE')
    expect(movie.title).toBe('External Only Movie')
  })

  it('POST /discovery/movies is idempotent — second call returns same id', async () => {
    mswServer.use(
      http.get(`${FAKE_TMDB_BASE}/movie/99999`, () => HttpResponse.json(FAKE_TMDB_MOVIE_DETAIL)),
    )

    const res1 = await discoveryApp.inject({
      method: 'POST',
      url: '/discovery/movies',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tmdbId: '99999' }),
    })
    expect(res1.statusCode).toBe(200)
    const { id: id1 } = res1.json<{ id: string }>()
    materializedMovieIds.push(id1)

    const res2 = await discoveryApp.inject({
      method: 'POST',
      url: '/discovery/movies',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tmdbId: '99999' }),
    })
    expect(res2.statusCode).toBe(200)
    const { id: id2 } = res2.json<{ id: string }>()

    expect(id1).toBe(id2)
  })

  it('GET /search succeeds with local results even when TMDB returns 500', async () => {
    mswServer.use(
      http.get(`${FAKE_TMDB_BASE}/search/movie`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${FAKE_TMDB_BASE}/search/tv`, () => new HttpResponse(null, { status: 500 })),
    )

    // Use a distinct query so the 60s in-memory cache from earlier tests doesn't interfere
    const res = await discoveryApp.inject({
      method: 'GET',
      url: '/search?q=TmdbDown',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<any>()
    expect(Array.isArray(body.movies)).toBe(true)
    expect(body.externalMovies).toEqual([])
    expect(body.externalSeries).toEqual([])
  })

  it('POST /discovery/movies returns 409 for invalid tmdbId', async () => {
    const res = await discoveryApp.inject({
      method: 'POST',
      url: '/discovery/movies',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tmdbId: 'not-a-number' }),
    })
    expect(res.statusCode).toBe(409)
  })
})
