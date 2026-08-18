import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  sources,
  movies,
  series as seriesTable,
  seasons,
  episodes,
  movieAvailabilities,
  seriesAvailabilities,
  episodeAvailabilities,
  syncRuns,
  profiles,
  watchlist,
  viewingProgress,
  titleMatchResults,
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
import { resolvePlayback } from '../../services/playback-resolver.js'
import { upsertProgress } from '../../services/viewing-progress-service.js'

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
// Poll the DB until a sync run reaches a terminal state
// ---------------------------------------------------------------------------

async function waitForSyncRunId(runId: string, timeoutMs = 15_000): Promise<typeof syncRuns.$inferSelect> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [row] = await db
      .select()
      .from(syncRuns)
      .where(and(eq(syncRuns.id, runId), inArray(syncRuns.status, ['COMPLETED', 'FAILED'])))
    if (row) return row
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Sync run ${runId} did not complete within ${timeoutMs}ms`)
}

// ---------------------------------------------------------------------------
// Fastify app
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

// Pre-seeded canonical IDs (cleared and re-seeded in beforeAll)
let preSeededMovieIds: string[] = []
let preSeededSeriesId: string | null = null

beforeAll(async () => {
  mswServer.listen({ onUnhandledRequest: 'bypass' })

  // Fetch series info so episode data is captured during sync
  process.env.XTREAM_FETCH_SERIES_INFO = 'true'

  // Remove any stale pre-seeded rows from previous crashed runs, then re-seed.
  // Local title-matching will resolve these exact titles with confidence=1.0 (no live TMDB calls).
  await db.delete(movies).where(inArray(movies.title, ['Integration Movie One', 'Integration Movie Two']))
  await db.delete(seriesTable).where(eq(seriesTable.title, 'Integration Series One'))

  const seededMovies = await db
    .insert(movies)
    .values([{ title: 'Integration Movie One' }, { title: 'Integration Movie Two' }])
    .returning({ id: movies.id })
  preSeededMovieIds = seededMovies.map((r) => r.id)

  const [seededSeries] = await db
    .insert(seriesTable)
    .values([{ title: 'Integration Series One' }])
    .returning({ id: seriesTable.id })
  preSeededSeriesId = seededSeries?.id ?? null

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
  delete process.env.XTREAM_FETCH_SERIES_INFO

  if (preSeededMovieIds.length > 0) {
    await db.delete(movies).where(inArray(movies.id, preSeededMovieIds))
    preSeededMovieIds = []
  }
  if (preSeededSeriesId) {
    await db.delete(seriesTable).where(eq(seriesTable.id, preSeededSeriesId))
    preSeededSeriesId = null
  }
})

// Per-test cleanup: delete source-specific records; canonical movies/series persist for reuse
let cleanupSourceId: string | null = null
let cleanupProfileId: string | null = null

afterEach(async () => {
  mswServer.resetHandlers()

  if (cleanupProfileId) {
    await db.delete(profiles).where(eq(profiles.id, cleanupProfileId))
    cleanupProfileId = null
  }

  if (!cleanupSourceId) return

  const sourceId = cleanupSourceId
  cleanupSourceId = null

  // Delete source-scoped records. Canonical movies/series are pre-seeded in beforeAll and
  // shared across all tests — only afterAll removes them.
  await db.delete(movieAvailabilities).where(eq(movieAvailabilities.providerId, sourceId))
  await db.delete(seriesAvailabilities).where(eq(seriesAvailabilities.providerId, sourceId))
  await db.delete(episodeAvailabilities).where(eq(episodeAvailabilities.providerId, sourceId))
  await db.delete(titleMatchResults).where(eq(titleMatchResults.providerId, sourceId))
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
    const { id: syncRunId } = syncRes.json<{ id: string }>()
    const completedRun = await waitForSyncRunId(syncRunId)
    expect(completedRun.status).toBe('COMPLETED')

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
    const { id: emptySyncRunId } = syncRes.json<{ id: string }>()
    const emptyCompletedRun = await waitForSyncRunId(emptySyncRunId)
    expect(emptyCompletedRun.status).toBe('COMPLETED')
    expect(emptyCompletedRun.moviesCreated).toBe(0)
    expect(emptyCompletedRun.seriesCreated).toBe(0)

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

  it('episode slice: catalog API exposes episode availability and progress is tracked per episode', async () => {
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, ({ request }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action') ?? ''

        if (action === 'get_server_info' || action === 'get_account_info') {
          return HttpResponse.json(FAKE_ACCOUNT_INFO)
        }
        if (action === 'get_vod_categories' || action === 'get_series_categories') {
          return HttpResponse.json([{ category_id: '10', category_name: 'Drama', parent_id: 0 }])
        }
        if (action === 'get_vod_streams') return HttpResponse.json([])
        if (action === 'get_series') return HttpResponse.json(FAKE_SERIES_LIST)
        if (action === 'get_series_info') {
          return HttpResponse.json({
            info: {
              name: 'Integration Series One', cover: '', plot: '', cast: '', director: '',
              genre: '', releaseDate: '2022-01-01', last_modified: '', rating: '8.5',
              rating_5based: 4.25, backdrop_path: [], youtube_trailer: '', episode_run_time: '45',
              category_id: '10', category_name: 'Drama',
            },
            episodes: {
              '1': [
                {
                  id: '8001', episode_num: 1, title: 'Pilot FR 1080p', container_extension: 'mp4',
                  info: { duration_secs: 2700, duration: '45:00', releasedate: '2022-01-15' },
                },
                {
                  id: '8002', episode_num: 2, title: 'Second Episode', container_extension: 'mp4',
                  info: { duration_secs: 2400, duration: '40:00', releasedate: '2022-01-22' },
                },
              ],
            },
          })
        }
        return HttpResponse.json([])
      }),
    )

    // 1. Create source and sync (XTREAM_FETCH_SERIES_INFO is set globally in beforeAll)
    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Catalog Episode Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'testuser', password: 'testpass' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    const syncRes = await app.inject({ method: 'POST', url: '/sync-runs', body: { sourceId: source.id } })
    expect(syncRes.statusCode).toBe(201)
    const { id: syncRunId } = syncRes.json<{ id: string }>()
    const completedRun = await waitForSyncRunId(syncRunId)
    expect(completedRun.status).toBe('COMPLETED')

    // 2. Resolve canonical series ID
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
    const seriesId = seriesAvailRow!.seriesId

    // 3. Season 1 must exist with correct seriesId
    const [seasonRow] = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesId), eq(seasons.seasonNumber, 1)))
    expect(seasonRow).toBeDefined()

    // 4. Two episode rows in season 1 with correct episodeNumbers
    const episodeRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, seasonRow!.id))
      .orderBy(asc(episodes.episodeNumber))
    expect(episodeRows.length).toBeGreaterThanOrEqual(2)
    const ep1 = episodeRows.find((e) => e.episodeNumber === 1)
    const ep2 = episodeRows.find((e) => e.episodeNumber === 2)
    expect(ep1).toBeDefined()
    expect(ep2).toBeDefined()

    const ep1Id = ep1!.id

    // 5. episodeAvailabilities keyed by canonical episodeId, not series/season ID
    const ep1Avails = await db
      .select()
      .from(episodeAvailabilities)
      .where(
        and(
          eq(episodeAvailabilities.episodeId, ep1Id),
          eq(episodeAvailabilities.providerId, source.id),
        ),
      )
    expect(ep1Avails).toHaveLength(1)
    expect(ep1Avails[0]?.status).toBe('AVAILABLE')
    expect(ep1Avails[0]?.providerItemId).toBe('8001')
    expect(ep1Avails[0]?.episodeId).toBe(ep1Id)
    expect(ep1Avails[0]?.containerExtension).toBe('mp4')

    // 6. Catalog API returns episodes with correct availability metadata
    const epListRes = await app.inject({ method: 'GET', url: `/series/${seriesId}/seasons/1/episodes` })
    expect(epListRes.statusCode).toBe(200)
    const epList = epListRes.json<any[]>()
    const ep1Response = epList.find((e) => e.id === ep1Id)
    expect(ep1Response).toBeDefined()
    expect(ep1Response).toMatchObject({ episodeNumber: 1, availabilityStatus: 'AVAILABLE', availabilityCount: 1 })
    expect((ep1Response?.variants ?? []).length).toBeGreaterThanOrEqual(1)

    // 7. Progress stored keyed on (profileId, EPISODE, episodeId), not parent series
    const [profile] = await db.insert(profiles).values({ name: 'Catalog Episode Watcher' }).returning()
    cleanupProfileId = profile.id
    await upsertProgress(profile.id, 'EPISODE', ep1Id, 840, 2700)

    const [progressRow] = await db
      .select()
      .from(viewingProgress)
      .where(
        and(
          eq(viewingProgress.profileId, profile.id),
          eq(viewingProgress.mediaType, 'EPISODE'),
          eq(viewingProgress.mediaId, ep1Id),
        ),
      )
    expect(progressRow).toBeDefined()
    expect(progressRow?.progressSeconds).toBe(840)
    expect(progressRow?.mediaId).toBe(ep1Id)

    // 8. Catalog reflects per-episode watch state — only episode 1 is in_progress
    const profileEpRes = await app.inject({
      method: 'GET',
      url: `/series/${seriesId}/seasons/1/episodes?profileId=${profile.id}`,
    })
    expect(profileEpRes.statusCode).toBe(200)
    const profileEpList = profileEpRes.json<any[]>()
    const ep1WithProfile = profileEpList.find((e) => e.id === ep1Id)
    const ep2WithProfile = profileEpList.find((e) => e.id === ep2!.id)
    expect(ep1WithProfile?.watchState).toBe('in_progress')
    expect(ep2WithProfile?.watchState).toBe('unwatched')
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
    expect(syncRes.statusCode).toBe(201)
    const { id: errSyncRunId } = syncRes.json<{ id: string }>()
    const failedRun = await waitForSyncRunId(errSyncRunId)
    expect(failedRun.status).toBe('FAILED')
    expect(failedRun.errorMessage).toBeTruthy()
  })

  it('GET /search returns only movies and series (no external fields); GET /search/remote returns empty arrays when no discovery service', async () => {
    // Use a fresh app without discovery service to verify response shapes
    const bareApp = Fastify({ logger: false })
    await bareApp.register(searchRoutes)
    await bareApp.ready()

    const searchRes = await bareApp.inject({ method: 'GET', url: '/search?q=Integration' })
    expect(searchRes.statusCode).toBe(200)
    const searchBody = searchRes.json<any>()
    expect(Array.isArray(searchBody.movies)).toBe(true)
    expect(Array.isArray(searchBody.series)).toBe(true)
    expect(searchBody).not.toHaveProperty('externalMovies')
    expect(searchBody).not.toHaveProperty('externalSeries')

    const remoteRes = await bareApp.inject({ method: 'GET', url: '/search/remote?q=Integration' })
    expect(remoteRes.statusCode).toBe(200)
    const remoteBody = remoteRes.json<any>()
    expect(remoteBody.externalMovies).toEqual([])
    expect(remoteBody.externalSeries).toEqual([])

    await bareApp.close()
  })

  it('episode slice: sync creates canonical episode rows; resolvePlayback uses episodeId; progress persists as startPositionSeconds', async () => {
    mswServer.use(
      http.get(`${FAKE_BASE}/player_api.php`, ({ request }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action') ?? ''
        if (action === 'get_server_info' || action === 'get_account_info') {
          return HttpResponse.json(FAKE_ACCOUNT_INFO)
        }
        if (action === 'get_vod_categories' || action === 'get_series_categories') {
          return HttpResponse.json([{ category_id: '10', category_name: 'Drama', parent_id: 0 }])
        }
        if (action === 'get_vod_streams') return HttpResponse.json([])
        if (action === 'get_series') return HttpResponse.json(FAKE_SERIES_LIST)
        if (action === 'get_series_info') {
          return HttpResponse.json({
            info: {
              name: 'Integration Series One', cover: '', plot: 'A drama.', cast: '',
              director: '', genre: 'Drama', releaseDate: '2022-01-01', last_modified: '1640000000',
              rating: '8.5', rating_5based: 4.25, backdrop_path: [], youtube_trailer: '',
              episode_run_time: '45', category_id: '10', category_name: 'Drama',
            },
            episodes: {
              '1': [
                {
                  id: '7001', episode_num: 1, title: 'Pilot FR 1080p', container_extension: 'mkv',
                  info: { duration_secs: 2700, duration: '45:00', releasedate: '2022-01-10' },
                },
              ],
            },
          })
        }
        return HttpResponse.json([])
      }),
    )

    // 1. Create source and sync
    const createRes = await app.inject({
      method: 'POST',
      url: '/sources',
      body: { name: 'Episode Slice Source', type: 'XTREAM', baseUrl: FAKE_BASE, username: 'testuser', password: 'testpass' },
    })
    expect(createRes.statusCode).toBe(201)
    const source = createRes.json<{ id: string }>()
    cleanupSourceId = source.id

    const syncRes = await app.inject({ method: 'POST', url: '/sync-runs', body: { sourceId: source.id } })
    expect(syncRes.statusCode).toBe(201)
    const { id: epSyncRunId } = syncRes.json<{ id: string }>()
    const epCompletedRun = await waitForSyncRunId(epSyncRunId)
    expect(epCompletedRun.status).toBe('COMPLETED')

    // 2. Verify canonical series → season → episode chain in DB
    const [seriesAvailRow] = await db
      .select({ seriesId: seriesAvailabilities.seriesId })
      .from(seriesAvailabilities)
      .where(and(
        eq(seriesAvailabilities.providerId, source.id),
        eq(seriesAvailabilities.providerItemId, '6001'),
      ))
    expect(seriesAvailRow).toBeDefined()

    const [seasonRow] = await db
      .select({ id: seasons.id, seasonNumber: seasons.seasonNumber })
      .from(seasons)
      .where(eq(seasons.seriesId, seriesAvailRow.seriesId))
    expect(seasonRow).toBeDefined()
    expect(seasonRow.seasonNumber).toBe(1)

    const [episodeRow] = await db
      .select({ id: episodes.id, seriesId: episodes.seriesId })
      .from(episodes)
      .where(and(eq(episodes.seasonId, seasonRow.id), eq(episodes.episodeNumber, 1)))
    expect(episodeRow).toBeDefined()
    expect(episodeRow.seriesId).toBe(seriesAvailRow.seriesId)

    // 3. Verify episodeAvailabilities is keyed on canonical episodeId (not seriesId)
    const [epAvailRow] = await db
      .select({
        status: episodeAvailabilities.status,
        episodeId: episodeAvailabilities.episodeId,
        providerItemId: episodeAvailabilities.providerItemId,
      })
      .from(episodeAvailabilities)
      .where(eq(episodeAvailabilities.episodeId, episodeRow.id))
    expect(epAvailRow).toBeDefined()
    expect(epAvailRow.status).toBe('AVAILABLE')
    expect(epAvailRow.episodeId).toBe(episodeRow.id)
    expect(epAvailRow.providerItemId).toBe('7001')

    // 4. Create a profile (needed by resolvePlayback → getProfilePreferences)
    const [profile] = await db.insert(profiles).values({ name: 'Episode Slice Viewer' }).returning()
    cleanupProfileId = profile.id

    // 5. resolvePlayback for the episode returns gatewayUrl and DIRECT deliveryMode (XTREAM always DIRECT)
    const session = await resolvePlayback(profile.id, 'episode', episodeRow.id)
    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(session.deliveryMode).toBe('DIRECT')
    expect(session.startPositionSeconds).toBe(0)

    // 6. Persist progress against the episodeId (not the seriesId)
    await upsertProgress(profile.id, 'EPISODE', episodeRow.id, 300, 2700)

    // 7. Subsequent resolvePlayback must return stored progress as startPositionSeconds
    const session2 = await resolvePlayback(profile.id, 'episode', episodeRow.id)
    expect(session2.startPositionSeconds).toBe(300)
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
    const { id: sync1RunId } = sync1Res.json<{ id: string }>()
    const completed1 = await waitForSyncRunId(sync1RunId)
    expect(completed1.status).toBe('COMPLETED')

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
    const { id: sync2RunId } = sync2Res.json<{ id: string }>()
    const completed2 = await waitForSyncRunId(sync2RunId)
    expect(completed2.status).toBe('COMPLETED')

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

    const localRes = await discoveryApp.inject({
      method: 'GET',
      url: '/search?q=External+Only',
    })
    expect(localRes.statusCode).toBe(200)
    const localBody = localRes.json<any>()
    expect(localBody.movies).toHaveLength(0)
    expect(localBody).not.toHaveProperty('externalMovies')

    const res = await discoveryApp.inject({
      method: 'GET',
      url: '/search/remote?q=External+Only',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<any>()
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

    // Remote search should now exclude the locally known tmdbId
    const res = await discoveryApp.inject({
      method: 'GET',
      url: '/search/remote?q=External+Only',
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
    const localRes = await discoveryApp.inject({
      method: 'GET',
      url: '/search?q=TmdbDown',
    })
    expect(localRes.statusCode).toBe(200)
    const localBody = localRes.json<any>()
    expect(Array.isArray(localBody.movies)).toBe(true)
    expect(localBody).not.toHaveProperty('externalMovies')

    const remoteRes = await discoveryApp.inject({
      method: 'GET',
      url: '/search/remote?q=TmdbDown',
    })
    expect(remoteRes.statusCode).toBe(200)
    const remoteBody = remoteRes.json<any>()
    expect(remoteBody.externalMovies).toEqual([])
    expect(remoteBody.externalSeries).toEqual([])
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
