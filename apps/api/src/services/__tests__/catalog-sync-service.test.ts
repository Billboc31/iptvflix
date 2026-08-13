import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { sources } from '../../db/schema/sources.js'
import { movieAvailabilities, seriesAvailabilities, episodeAvailabilities } from '../../db/schema/availabilities.js'
import { syncRuns } from '../../db/schema/sync-runs.js'
import { releaseEvents } from '../../db/schema/release-lifecycle.js'
import { CatalogSyncService, SyncAlreadyRunningError } from '../catalog-sync-service.js'
import { withBoundedConcurrency } from '../sync-runs-service.js'
import { TitleMatchingService, type MatchItemInput, type MatchResult } from '../title-matching-service.js'
import type { XtreamCatalogSnapshot, XtreamVodStream, XtreamSeries, XtreamSeriesInfo } from '../../providers/xtream/types.js'
import type { PlexCatalogSnapshot } from '../../providers/plex/types.js'

let testSourceId: string

function makeVodStream(overrides: Partial<XtreamVodStream> & { stream_id: number; name: string }): XtreamVodStream {
  return {
    num: overrides.stream_id,
    stream_icon: '',
    rating: '0',
    added: '1700000000',
    category_id: '1',
    container_extension: 'mkv',
    tmdb: '',
    ...overrides,
  }
}

function makeSeriesEntry(overrides: Partial<XtreamSeries> & { series_id: number; name: string }): XtreamSeries {
  return {
    cover: '',
    category_id: '1',
    rating: '0',
    ...overrides,
  }
}

function makeSnapshot(
  vodStreams: XtreamVodStream[],
  seriesEntries: XtreamSeries[],
  fetchedAt: Date,
  seriesInfo?: Record<number, XtreamSeriesInfo>,
): XtreamCatalogSnapshot {
  return {
    sourceId: testSourceId,
    fetchedAt,
    vodCategories: [],
    vodStreams,
    seriesCategories: [],
    series: seriesEntries,
    seriesInfo,
  }
}

function makeSeriesInfo(episodes: Record<string, Array<{ id: string; episode_num: number; title: string; releasedate?: string }>>): XtreamSeriesInfo {
  return {
    info: {
      name: '',
      cover: '',
      plot: '',
      cast: '',
      director: '',
      genre: '',
      releaseDate: '',
      last_modified: '',
      rating: '0',
      rating_5based: 0,
      backdrop_path: [],
      youtube_trailer: '',
      episode_run_time: '',
      category_id: '1',
      category_name: '',
    },
    episodes: Object.fromEntries(
      Object.entries(episodes).map(([season, eps]) => [
        season,
        eps.map((ep) => ({
          id: ep.id,
          episode_num: ep.episode_num,
          title: ep.title,
          container_extension: 'mkv',
          info: {
            duration_secs: 2700,
            duration: '00:45:00',
            releasedate: ep.releasedate,
          },
        })),
      ]),
    ),
  }
}

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({ name: 'Sync Test Source', type: 'XTREAM', baseUrl: 'http://test.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId = source.id
})

afterAll(async () => {
  await db.delete(sources).where(eq(sources.id, testSourceId))
})

afterEach(async () => {
  const movieRows = await db
    .select({ movieId: movieAvailabilities.movieId })
    .from(movieAvailabilities)
    .where(eq(movieAvailabilities.providerId, testSourceId))
  if (movieRows.length > 0) {
    const movieIds = movieRows.map((r) => r.movieId)
    await db.delete(releaseEvents).where(inArray(releaseEvents.mediaId, movieIds))
    await db.delete(movies).where(inArray(movies.id, movieIds))
  }

  const seriesRows = await db
    .select({ seriesId: seriesAvailabilities.seriesId })
    .from(seriesAvailabilities)
    .where(eq(seriesAvailabilities.providerId, testSourceId))
  if (seriesRows.length > 0) {
    const seriesIds = seriesRows.map((r) => r.seriesId)
    await db.delete(releaseEvents).where(inArray(releaseEvents.mediaId, seriesIds))
    const epRows = await db
      .select({ episodeId: episodeAvailabilities.episodeId })
      .from(episodeAvailabilities)
      .where(eq(episodeAvailabilities.providerId, testSourceId))
    if (epRows.length > 0) {
      await db.delete(releaseEvents).where(inArray(releaseEvents.mediaId, epRows.map((r) => r.episodeId)))
    }
    // cascade: series → seasons → episodes → episodeAvailabilities
    await db.delete(seriesTable).where(inArray(seriesTable.id, seriesIds))
  }

  await db.delete(syncRuns).where(eq(syncRuns.sourceId, testSourceId))
})

describe('CatalogSyncService', () => {
  describe('first sync', () => {
    it('creates movies, availabilities, series, and a COMPLETED sync run', async () => {
      const fetchedAt = new Date('2026-01-01T10:00:00Z')
      const snapshot = makeSnapshot(
        [
          makeVodStream({ stream_id: 1, name: 'Movie Alpha', tmdb: '9000111', plot: 'A plot' }),
          makeVodStream({ stream_id: 2, name: 'Movie Beta' }),
        ],
        [makeSeriesEntry({ series_id: 10, name: 'Series One', releaseDate: '2022-03-15' })],
        fetchedAt,
      )

      const result = await CatalogSyncService.syncCatalog(testSourceId, snapshot)

      expect(result.status).toBe('completed')
      expect(result.counts.moviesCreated).toBe(2)
      expect(result.counts.moviesUpdated).toBe(0)
      expect(result.counts.seriesCreated).toBe(1)
      expect(result.counts.seriesUpdated).toBe(0)
      expect(result.counts.unavailableCount).toBe(0)

      // Verify movie availability rows
      const movieAvRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(movieAvRows).toHaveLength(2)
      for (const row of movieAvRows) {
        expect(row.status).toBe('AVAILABLE')
        expect(row.firstSeenAt.toISOString()).toBe(fetchedAt.toISOString())
        expect(row.lastSeenAt.toISOString()).toBe(fetchedAt.toISOString())
        expect(row.unavailableAt).toBeNull()
      }

      // Verify tmdbId mapped correctly
      const [av1] = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerItemId, '1'))
      const [movie1] = await db.select().from(movies).where(eq(movies.id, av1.movieId))
      expect(movie1.title).toBe('Movie Alpha')
      expect(movie1.tmdbId).toBe(9000111)
      expect(movie1.synopsis).toBe('A plot')

      // Verify series availability row
      const serAvRows = await db
        .select()
        .from(seriesAvailabilities)
        .where(eq(seriesAvailabilities.providerId, testSourceId))
      expect(serAvRows).toHaveLength(1)
      expect(serAvRows[0].status).toBe('AVAILABLE')
      expect(serAvRows[0].firstSeenAt.toISOString()).toBe(fetchedAt.toISOString())

      const [ser] = await db.select().from(seriesTable).where(eq(seriesTable.id, serAvRows[0].seriesId))
      expect(ser.title).toBe('Series One')
      expect(ser.firstAirYear).toBe(2022)

      // Verify sync run
      const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.runId))
      expect(run.status).toBe('COMPLETED')
      expect(run.moviesCreated).toBe(2)
      expect(run.seriesCreated).toBe(1)
    })
  })

  describe('repeat sync', () => {
    it('does not create duplicate rows and updates lastSeenAt without changing firstSeenAt', async () => {
      const firstFetch = new Date('2026-01-01T10:00:00Z')
      const secondFetch = new Date('2026-01-02T10:00:00Z')
      const stream = makeVodStream({ stream_id: 3, name: 'Stable Movie' })
      const seriesEntry = makeSeriesEntry({ series_id: 20, name: 'Stable Series' })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], firstFetch))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], secondFetch))

      // No duplicate rows
      const movieAvRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(movieAvRows).toHaveLength(1)

      const serAvRows = await db
        .select()
        .from(seriesAvailabilities)
        .where(eq(seriesAvailabilities.providerId, testSourceId))
      expect(serAvRows).toHaveLength(1)

      // firstSeenAt preserved, lastSeenAt updated
      expect(movieAvRows[0].firstSeenAt.toISOString()).toBe(firstFetch.toISOString())
      expect(movieAvRows[0].lastSeenAt.toISOString()).toBe(secondFetch.toISOString())
      expect(serAvRows[0].firstSeenAt.toISOString()).toBe(firstFetch.toISOString())
      expect(serAvRows[0].lastSeenAt.toISOString()).toBe(secondFetch.toISOString())
    })
  })

  describe('disappearance', () => {
    it('marks missing items as UNAVAILABLE without deleting rows', async () => {
      const t1 = new Date('2026-01-01T10:00:00Z')
      const t2 = new Date('2026-01-02T10:00:00Z')
      const streamA = makeVodStream({ stream_id: 4, name: 'Movie Present' })
      const streamB = makeVodStream({ stream_id: 5, name: 'Movie Gone' })

      // First sync: both A and B
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([streamA, streamB], [], t1))

      // Second sync: only A
      const result = await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([streamA], [], t2))

      expect(result.counts.unavailableCount).toBe(1)
      expect(result.counts.moviesUpdated).toBe(1)

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(2)

      const rowA = avRows.find((r) => r.providerItemId === '4')!
      const rowB = avRows.find((r) => r.providerItemId === '5')!

      expect(rowA.status).toBe('AVAILABLE')
      expect(rowA.unavailableAt).toBeNull()

      expect(rowB.status).toBe('UNAVAILABLE')
      expect(rowB.unavailableAt!.toISOString()).toBe(t2.toISOString())
    })
  })

  describe('reappearance', () => {
    it('restores AVAILABLE status, clears unavailableAt, updates lastSeenAt, preserves firstSeenAt', async () => {
      const t1 = new Date('2026-01-01T10:00:00Z')
      const t2 = new Date('2026-01-02T10:00:00Z')
      const t3 = new Date('2026-01-03T10:00:00Z')
      const stream = makeVodStream({ stream_id: 6, name: 'Returning Movie' })

      // First sync: item seen
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], t1))
      // Second sync: item gone
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [], t2))
      // Third sync: item reappears
      const result = await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], t3))

      expect(result.status).toBe('completed')
      expect(result.counts.moviesUpdated).toBe(1)

      const [avRow] = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))

      expect(avRow.status).toBe('AVAILABLE')
      expect(avRow.unavailableAt).toBeNull()
      expect(avRow.firstSeenAt.toISOString()).toBe(t1.toISOString())
      expect(avRow.lastSeenAt.toISOString()).toBe(t3.toISOString())
    })
  })

  describe('retry / idempotency', () => {
    it('reuses an existing movie row when tmdbId already exists', async () => {
      const conflictTmdbId = 88001
      const fetchedAt = new Date('2026-01-01T10:00:00Z')

      const [existingMovie] = await db
        .insert(movies)
        .values({ title: 'Pre-existing Movie', tmdbId: conflictTmdbId })
        .returning()

      try {
        const result = await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot(
            [makeVodStream({ stream_id: 7, name: 'Conflict Movie', tmdb: String(conflictTmdbId) })],
            [],
            fetchedAt,
          ),
        )

        expect(result.status).toBe('completed')
        expect(result.counts.moviesCreated).toBe(1)

        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(1)
        expect(avRows[0].movieId).toBe(existingMovie.id)

        const movieRows = await db.select().from(movies).where(eq(movies.tmdbId, conflictTmdbId))
        expect(movieRows).toHaveLength(1)
      } finally {
        await db.delete(movieAvailabilities).where(eq(movieAvailabilities.providerId, testSourceId))
        await db.delete(movies).where(eq(movies.id, existingMovie.id))
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, testSourceId))
      }
    })

    it('maps two provider streams with the same tmdbId to one movie', async () => {
      const fetchedAt = new Date('2026-01-01T10:00:00Z')
      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [
            makeVodStream({ stream_id: 71, name: 'Dup A', tmdb: '99001' }),
            makeVodStream({ stream_id: 72, name: 'Dup B', tmdb: '99001' }),
          ],
          [],
          fetchedAt,
        ),
      )

      expect(result.status).toBe('completed')
      expect(result.counts.moviesCreated).toBe(2)

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(2)
      expect(avRows[0].movieId).toBe(avRows[1].movieId)

      const movieRows = await db.select().from(movies).where(eq(movies.tmdbId, 99001))
      expect(movieRows).toHaveLength(1)
    })

    it('ignores oversized tmdb ids that overflow postgres integer', async () => {
      // Real failure: Xtream sent 2447627521 (> int4 max 2147483647)
      const oversized = '2447627521'
      const fetchedAt = new Date('2026-01-01T10:00:00Z')
      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [makeVodStream({ stream_id: 73, name: 'Overflow Movie', tmdb: oversized })],
          [],
          fetchedAt,
        ),
      )

      expect(result.status).toBe('completed')
      expect(result.error).toBeUndefined()
      expect(result.counts.moviesCreated).toBe(1)

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(1)

      const [movie] = await db.select().from(movies).where(eq(movies.id, avRows[0].movieId))
      expect(movie.title).toBe('Overflow Movie')
      expect(movie.tmdbId).toBeNull()
    })
  })

  describe('concurrency', () => {
    it('throws SyncAlreadyRunningError when a RUNNING lock already exists for the source', async () => {
      // Simulate a concurrent process that holds the sync lock
      const [existingRun] = await db
        .insert(syncRuns)
        .values({ sourceId: testSourceId, status: 'RUNNING' })
        .returning()

      try {
        const snapshot = makeSnapshot(
          [makeVodStream({ stream_id: 8, name: 'Concurrent Movie' })],
          [],
          new Date('2026-01-01T10:00:00Z'),
        )

        await expect(
          CatalogSyncService.syncCatalog(testSourceId, snapshot),
        ).rejects.toBeInstanceOf(SyncAlreadyRunningError)

        // No catalog mutations should have occurred
        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(0)
      } finally {
        await db.delete(syncRuns).where(eq(syncRuns.id, existingRun.id))
      }
    })
  })

  describe('episode availability lifecycle', () => {
    it('does not touch episode availabilities when snapshot has no episode data', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const t2 = new Date('2026-02-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 100, name: 'No-Episode Series' })

      // First sync: create series + episodes
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, {
          100: makeSeriesInfo({ '1': [{ id: 'ep-100-1', episode_num: 1, title: 'Pilot' }] }),
        }),
      )

      const epAvRowsBefore = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRowsBefore).toHaveLength(1)
      expect(epAvRowsBefore[0].status).toBe('AVAILABLE')

      // Second sync: no seriesInfo → episodes must remain AVAILABLE
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2),
      )

      const epAvRowsAfter = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRowsAfter).toHaveLength(1)
      expect(epAvRowsAfter[0].status).toBe('AVAILABLE')
    })

    it('creates episode availability rows with correct timestamps on first episode snapshot', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 101, name: 'Episode Series' })

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, {
          101: makeSeriesInfo({
            '1': [
              { id: 'ep-101-1', episode_num: 1, title: 'Pilot', releasedate: '2024-01-01' },
              { id: 'ep-101-2', episode_num: 2, title: 'Part Two' },
            ],
          }),
        }),
      )

      expect(result.status).toBe('completed')

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)
      for (const row of epAvRows) {
        expect(row.status).toBe('AVAILABLE')
        expect(row.firstSeenAt.toISOString()).toBe(t1.toISOString())
        expect(row.lastSeenAt.toISOString()).toBe(t1.toISOString())
        expect(row.unavailableAt).toBeNull()
      }

      expect(epAvRows.map((r) => r.providerItemId).sort()).toEqual(['ep-101-1', 'ep-101-2'])
    })

    it('preserves firstSeenAt and updates lastSeenAt on repeated episode syncs', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const t2 = new Date('2026-02-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 102, name: 'Stable Episode Series' })
      const info = makeSeriesInfo({ '1': [{ id: 'ep-102-1', episode_num: 1, title: 'Stable Ep' }] })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 102: info }))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t2, { 102: info }))

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(1)
      expect(epAvRows[0].firstSeenAt.toISOString()).toBe(t1.toISOString())
      expect(epAvRows[0].lastSeenAt.toISOString()).toBe(t2.toISOString())
      expect(epAvRows[0].status).toBe('AVAILABLE')
    })

    it('marks a disappeared episode UNAVAILABLE when absent from an authoritative snapshot', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const t2 = new Date('2026-02-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 103, name: 'Disappearing Series' })

      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, {
          103: makeSeriesInfo({
            '1': [
              { id: 'ep-103-1', episode_num: 1, title: 'Keep' },
              { id: 'ep-103-2', episode_num: 2, title: 'Gone' },
            ],
          }),
        }),
      )

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2, {
          103: makeSeriesInfo({ '1': [{ id: 'ep-103-1', episode_num: 1, title: 'Keep' }] }),
        }),
      )

      expect(result.counts.unavailableCount).toBe(1)

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)

      const kept = epAvRows.find((r) => r.providerItemId === 'ep-103-1')!
      const gone = epAvRows.find((r) => r.providerItemId === 'ep-103-2')!

      expect(kept.status).toBe('AVAILABLE')
      expect(kept.unavailableAt).toBeNull()
      expect(gone.status).toBe('UNAVAILABLE')
      expect(gone.unavailableAt!.toISOString()).toBe(t2.toISOString())
    })

    it('restores a reappeared episode to AVAILABLE with original firstSeenAt and cleared unavailableAt', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const t2 = new Date('2026-02-02T10:00:00Z')
      const t3 = new Date('2026-02-03T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 104, name: 'Reappearing Series' })
      const info = makeSeriesInfo({ '1': [{ id: 'ep-104-1', episode_num: 1, title: 'Returning Ep' }] })

      // Seen
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 104: info }))
      // Gone
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2, { 104: makeSeriesInfo({ '1': [] }) }),
      )
      // Reappeared
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t3, { 104: info }))

      const [epAvRow] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))

      expect(epAvRow.status).toBe('AVAILABLE')
      expect(epAvRow.unavailableAt).toBeNull()
      expect(epAvRow.firstSeenAt.toISOString()).toBe(t1.toISOString())
      expect(epAvRow.lastSeenAt.toISOString()).toBe(t3.toISOString())
    })

    it('creates independent episode availabilities for the same canonical episode across two sources', async () => {
      const fetchedAt = new Date('2026-02-01T10:00:00Z')
      const [secondSource] = await db
        .insert(sources)
        .values({ name: 'Second Source', type: 'XTREAM', baseUrl: 'http://other.example.com', username: 'u2', password: 'p2' })
        .returning()

      // Canonical series row shared between both sources (simulates cross-source deduplication)
      const [canonicalSeries] = await db
        .insert(seriesTable)
        .values({ title: 'Multi-Source Series' })
        .returning()

      try {
        // Pre-insert seriesAvailabilities for both sources pointing to the same canonical series
        await db.insert(seriesAvailabilities).values([
          { seriesId: canonicalSeries.id, providerId: testSourceId, providerItemId: '105', firstSeenAt: fetchedAt, lastSeenAt: fetchedAt, status: 'AVAILABLE' },
          { seriesId: canonicalSeries.id, providerId: secondSource.id, providerItemId: '105', firstSeenAt: fetchedAt, lastSeenAt: fetchedAt, status: 'AVAILABLE' },
        ])

        const seriesEntry = makeSeriesEntry({ series_id: 105, name: 'Multi-Source Series' })
        const epInfo = makeSeriesInfo({ '1': [{ id: 'ep-105-1', episode_num: 1, title: 'Shared Ep' }] })

        // Source 1 syncs episode data → creates season + episode + availability
        await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot([], [seriesEntry], fetchedAt, { 105: epInfo }),
        )

        // Source 2 syncs same episode (different providerItemId) → reuses same season + episode
        const source2EpInfo = makeSeriesInfo({ '1': [{ id: 'ep-105-1-s2', episode_num: 1, title: 'Shared Ep' }] })
        await CatalogSyncService.syncCatalog(secondSource.id, {
          sourceId: secondSource.id,
          fetchedAt,
          vodCategories: [],
          vodStreams: [],
          seriesCategories: [],
          series: [seriesEntry],
          seriesInfo: { 105: source2EpInfo },
        })

        const source1Rows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, testSourceId))
        const source2Rows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, secondSource.id))

        expect(source1Rows).toHaveLength(1)
        expect(source2Rows).toHaveLength(1)
        expect(source1Rows[0].status).toBe('AVAILABLE')
        expect(source2Rows[0].status).toBe('AVAILABLE')
        expect(source1Rows[0].providerItemId).not.toBe(source2Rows[0].providerItemId)
        // Both availabilities point to the same canonical episode
        expect(source1Rows[0].episodeId).toBe(source2Rows[0].episodeId)
      } finally {
        await db.delete(seriesAvailabilities).where(eq(seriesAvailabilities.providerId, secondSource.id))
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, secondSource.id))
        await db.delete(sources).where(eq(sources.id, secondSource.id))
        // canonicalSeries is cleaned up by afterEach via testSourceId's seriesAvailabilities cascade
      }
    })

    it('does not reassign a provider item already attached to another canonical episode', async () => {
      const t1 = new Date('2026-02-01T10:00:00Z')
      const t2 = new Date('2026-02-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 106, name: 'Conflict Series' })

      // First sync: provider maps 'ep-conflict-1' to S01E01
      const infoEp1 = makeSeriesInfo({
        '1': [
          { id: 'ep-conflict-1', episode_num: 1, title: 'Ep 1' },
          { id: 'ep-conflict-2', episode_num: 2, title: 'Ep 2' },
        ],
      })
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 106: infoEp1 }))

      // Second sync: same provider remaps 'ep-conflict-1' to S01E02 (provider data corruption/bug)
      const infoRemap = makeSeriesInfo({
        '1': [
          { id: 'ep-conflict-2', episode_num: 1, title: 'Ep 1' },
          { id: 'ep-conflict-1', episode_num: 2, title: 'Ep 2 (remapped)' },
        ],
      })
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t2, { 106: infoRemap }))

      // ep-conflict-1 must still point to S01E01 (no reassignment)
      const rows = await db
        .select()
        .from(episodeAvailabilities)
        .where(
          and(
            eq(episodeAvailabilities.providerId, testSourceId),
            eq(episodeAvailabilities.providerItemId, 'ep-conflict-1'),
          ),
        )

      expect(rows).toHaveLength(1)

      // Verify it still belongs to the original episode (S01E01) by checking ep-conflict-2
      // went to S01E01 in t2 while ep-conflict-1 stayed on its original episode
      const ep1Rows = await db
        .select()
        .from(episodeAvailabilities)
        .where(
          and(
            eq(episodeAvailabilities.providerId, testSourceId),
            eq(episodeAvailabilities.providerItemId, 'ep-conflict-2'),
          ),
        )
      expect(ep1Rows).toHaveLength(1)
      // ep-conflict-1 and ep-conflict-2 must map to different episodes
      expect(rows[0].episodeId).not.toBe(ep1Rows[0].episodeId)
    })
  })

  describe('canonical Series identity resolution', () => {
    it('reuses an existing canonical series row when Xtream and Plex share the same TMDB ID', async () => {
      const fetchedAt = new Date('2026-03-01T10:00:00Z')
      const sharedTmdbId = 77001

      const xtreamSeriesInfo: Record<number, XtreamSeriesInfo> = {
        200: {
          ...makeSeriesInfo({}),
          info: { ...makeSeriesInfo({}).info, tmdb_id: String(sharedTmdbId) },
        },
      }
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [makeSeriesEntry({ series_id: 200, name: 'Breaking Bad' })], fetchedAt, xtreamSeriesInfo),
      )

      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Cross Source', type: 'PLEX', baseUrl: 'http://plex.test' })
        .returning()

      try {
        const plexSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt,
          movies: [],
          shows: [{ ratingKey: 'plex-200', title: 'Breaking Bad', Guid: [{ id: `tmdb://${sharedTmdbId}` }] }],
          episodes: [],
        }
        await CatalogSyncService.syncPlexCatalog(plexSource.id, plexSnapshot)

        const canonicalRows = await db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.tmdbId, sharedTmdbId))
        expect(canonicalRows).toHaveLength(1)

        const xtreamAvRows = await db
          .select()
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, testSourceId))
        const plexAvRows = await db
          .select()
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))

        expect(xtreamAvRows).toHaveLength(1)
        expect(plexAvRows).toHaveLength(1)
        expect(xtreamAvRows[0].seriesId).toBe(plexAvRows[0].seriesId)
      } finally {
        await db.delete(seriesAvailabilities).where(eq(seriesAvailabilities.providerId, plexSource.id))
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, plexSource.id))
        await db.delete(sources).where(eq(sources.id, plexSource.id))
        // canonical series cleaned up by afterEach via testSourceId availability
      }
    })

    it('creates a new canonical series when Plex-only and no existing match', async () => {
      const fetchedAt = new Date('2026-03-01T10:00:00Z')
      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Only Source', type: 'PLEX', baseUrl: 'http://plex2.test' })
        .returning()

      try {
        const plexSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt,
          movies: [],
          shows: [{ ratingKey: 'plex-300', title: 'Plex Only Series', Guid: [{ id: 'tmdb://88002' }] }],
          episodes: [],
        }
        await CatalogSyncService.syncPlexCatalog(plexSource.id, plexSnapshot)

        const canonicalRows = await db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.tmdbId, 88002))
        expect(canonicalRows).toHaveLength(1)
        expect(canonicalRows[0].title).toBe('Plex Only Series')

        const avRows = await db
          .select()
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))
        expect(avRows).toHaveLength(1)
        expect(avRows[0].seriesId).toBe(canonicalRows[0].id)
      } finally {
        const plexAvRows = await db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))
        if (plexAvRows.length > 0) {
          await db.delete(seriesTable).where(inArray(seriesTable.id, plexAvRows.map((r) => r.seriesId)))
        }
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, plexSource.id))
        await db.delete(sources).where(eq(sources.id, plexSource.id))
      }
    })

    it('does not merge same-title series from two providers when no TMDB ID is present', async () => {
      const fetchedAt = new Date('2026-03-01T10:00:00Z')
      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Ambiguous Source', type: 'PLEX', baseUrl: 'http://plex3.test' })
        .returning()

      try {
        await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot([], [makeSeriesEntry({ series_id: 400, name: 'Alias' })], fetchedAt),
        )

        const plexSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt,
          movies: [],
          shows: [{ ratingKey: 'plex-alias', title: 'Alias' }],
          episodes: [],
        }
        await CatalogSyncService.syncPlexCatalog(plexSource.id, plexSnapshot)

        const xtreamAvRows = await db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, testSourceId))
        const plexAvRows = await db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))

        expect(xtreamAvRows).toHaveLength(1)
        expect(plexAvRows).toHaveLength(1)
        expect(xtreamAvRows[0].seriesId).not.toBe(plexAvRows[0].seriesId)
      } finally {
        const plexAvRows = await db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))
        if (plexAvRows.length > 0) {
          await db.delete(seriesTable).where(inArray(seriesTable.id, plexAvRows.map((r) => r.seriesId)))
        }
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, plexSource.id))
        await db.delete(sources).where(eq(sources.id, plexSource.id))
      }
    })

    it('does not create duplicate series or availability rows when the same Plex snapshot is synced twice', async () => {
      const fetchedAt1 = new Date('2026-03-01T10:00:00Z')
      const fetchedAt2 = new Date('2026-03-02T10:00:00Z')
      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Repeat Source', type: 'PLEX', baseUrl: 'http://plex4.test' })
        .returning()

      try {
        const plexSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt: fetchedAt1,
          movies: [],
          shows: [{ ratingKey: 'plex-500', title: 'Idempotent Show', Guid: [{ id: 'tmdb://99999' }] }],
          episodes: [],
        }
        await CatalogSyncService.syncPlexCatalog(plexSource.id, plexSnapshot)
        await CatalogSyncService.syncPlexCatalog(plexSource.id, { ...plexSnapshot, fetchedAt: fetchedAt2 })

        const canonicalRows = await db
          .select()
          .from(seriesTable)
          .where(eq(seriesTable.tmdbId, 99999))
        expect(canonicalRows).toHaveLength(1)

        const avRows = await db
          .select()
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))
        expect(avRows).toHaveLength(1)
      } finally {
        const plexAvRows = await db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, plexSource.id))
        if (plexAvRows.length > 0) {
          await db.delete(seriesTable).where(inArray(seriesTable.id, plexAvRows.map((r) => r.seriesId)))
        }
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, plexSource.id))
        await db.delete(sources).where(eq(sources.id, plexSource.id))
      }
    })
  })

  describe('partial episode-fetch safety', () => {
    it('withBoundedConcurrency limits concurrent in-flight tasks', async () => {
      let peak = 0
      let inflight = 0
      const limit = 3
      const totalTasks = 10

      const tasks = Array.from({ length: totalTasks }, () => async () => {
        inflight++
        peak = Math.max(peak, inflight)
        await new Promise<void>((resolve) => setTimeout(resolve, 10))
        inflight--
      })

      await withBoundedConcurrency(tasks, limit)
      expect(peak).toBeLessThanOrEqual(limit)
    })

    it('one failing series does not mark other series episodes UNAVAILABLE', async () => {
      const t1 = new Date('2026-03-01T10:00:00Z')
      const t2 = new Date('2026-03-02T10:00:00Z')
      const seriesA = makeSeriesEntry({ series_id: 700, name: 'Series A' })
      const seriesB = makeSeriesEntry({ series_id: 701, name: 'Series B' })
      const infoA = makeSeriesInfo({ '1': [{ id: 'ep-700-1', episode_num: 1, title: 'A Ep 1' }] })
      const infoB = makeSeriesInfo({ '1': [{ id: 'ep-701-1', episode_num: 1, title: 'B Ep 1' }] })

      // First sync: both series with episodes
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesA, seriesB], t1, { 700: infoA, 701: infoB }),
      )

      // Second sync: series B's getSeriesInfo failed — snapshot carries only series A episodes
      const partialSnapshot: XtreamCatalogSnapshot = {
        ...makeSnapshot([], [seriesA, seriesB], t2, { 700: infoA }),
        failedSeriesIds: [701],
      }
      const result = await CatalogSyncService.syncCatalog(testSourceId, partialSnapshot)

      expect(result.status).toBe('completed')

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)

      const epA = epAvRows.find((r) => r.providerItemId === 'ep-700-1')!
      const epB = epAvRows.find((r) => r.providerItemId === 'ep-701-1')!

      expect(epA.status).toBe('AVAILABLE')
      expect(epB.status).toBe('AVAILABLE')
      expect(epB.unavailableAt).toBeNull()
    })

    it('failed series info calls are reflected in counts.failedCount', async () => {
      const t1 = new Date('2026-03-01T10:00:00Z')
      const seriesA = makeSeriesEntry({ series_id: 800, name: 'Series A' })
      const seriesB = makeSeriesEntry({ series_id: 801, name: 'Series B' })

      const partialSnapshot: XtreamCatalogSnapshot = {
        ...makeSnapshot([], [seriesA, seriesB], t1, { 800: makeSeriesInfo({ '1': [] }) }),
        failedSeriesIds: [801],
      }

      const result = await CatalogSyncService.syncCatalog(testSourceId, partialSnapshot)
      expect(result.counts.failedCount).toBe(1)
    })
  })

  describe('source lifecycle events', () => {
    it('records exactly one SOURCE_APPEARED event per movie and series on first sync', async () => {
      const t1 = new Date('2026-05-01T10:00:00Z')
      const stream = makeVodStream({ stream_id: 500, name: 'Lifecycle Movie' })
      const seriesEntry = makeSeriesEntry({ series_id: 500, name: 'Lifecycle Series' })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], t1))

      const [movieAv] = await db
        .select()
        .from(movieAvailabilities)
        .where(and(eq(movieAvailabilities.providerItemId, '500'), eq(movieAvailabilities.providerId, testSourceId)))
      const [seriesAv] = await db
        .select()
        .from(seriesAvailabilities)
        .where(and(eq(seriesAvailabilities.providerItemId, '500'), eq(seriesAvailabilities.providerId, testSourceId)))

      const movieEvents = await db
        .select()
        .from(releaseEvents)
        .where(and(eq(releaseEvents.mediaId, movieAv.movieId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
      expect(movieEvents).toHaveLength(1)
      expect(movieEvents[0].sourceId).toBe(testSourceId)
      expect(movieEvents[0].occurredAt.toISOString()).toBe(t1.toISOString())

      const seriesEvents = await db
        .select()
        .from(releaseEvents)
        .where(and(eq(releaseEvents.mediaId, seriesAv.seriesId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
      expect(seriesEvents).toHaveLength(1)
      expect(seriesEvents[0].sourceId).toBe(testSourceId)
    })

    it('does not create additional events when re-syncing with an identical snapshot', async () => {
      const t1 = new Date('2026-05-01T10:00:00Z')
      const t2 = new Date('2026-05-02T10:00:00Z')
      const stream = makeVodStream({ stream_id: 501, name: 'Stable Lifecycle Movie' })
      const seriesEntry = makeSeriesEntry({ series_id: 501, name: 'Stable Lifecycle Series' })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], t1))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], t2))

      const [movieAv] = await db
        .select()
        .from(movieAvailabilities)
        .where(and(eq(movieAvailabilities.providerItemId, '501'), eq(movieAvailabilities.providerId, testSourceId)))
      const movieEvents = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, movieAv.movieId))
      expect(movieEvents).toHaveLength(1)
      expect(movieEvents[0].eventType).toBe('SOURCE_APPEARED')

      const [seriesAv] = await db
        .select()
        .from(seriesAvailabilities)
        .where(and(eq(seriesAvailabilities.providerItemId, '501'), eq(seriesAvailabilities.providerId, testSourceId)))
      const seriesEvts = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, seriesAv.seriesId))
      expect(seriesEvts).toHaveLength(1)
      expect(seriesEvts[0].eventType).toBe('SOURCE_APPEARED')
    })

    it('records SOURCE_DISAPPEARED when a previously AVAILABLE item is absent from the snapshot', async () => {
      const t1 = new Date('2026-05-01T10:00:00Z')
      const t2 = new Date('2026-05-02T10:00:00Z')
      const stream = makeVodStream({ stream_id: 502, name: 'Disappearing Lifecycle Movie' })
      const seriesEntry = makeSeriesEntry({ series_id: 502, name: 'Disappearing Lifecycle Series' })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [seriesEntry], t1))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [], t2))

      const [movieAv] = await db
        .select()
        .from(movieAvailabilities)
        .where(and(eq(movieAvailabilities.providerItemId, '502'), eq(movieAvailabilities.providerId, testSourceId)))
      const movieEvents = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, movieAv.movieId))
      expect(movieEvents.filter((e) => e.eventType === 'SOURCE_APPEARED')).toHaveLength(1)
      const movieDisappeared = movieEvents.filter((e) => e.eventType === 'SOURCE_DISAPPEARED')
      expect(movieDisappeared).toHaveLength(1)
      expect(movieDisappeared[0].sourceId).toBe(testSourceId)
      expect(movieDisappeared[0].occurredAt.toISOString()).toBe(t2.toISOString())

      const [seriesAv] = await db
        .select()
        .from(seriesAvailabilities)
        .where(and(eq(seriesAvailabilities.providerItemId, '502'), eq(seriesAvailabilities.providerId, testSourceId)))
      const seriesEvts = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, seriesAv.seriesId))
      expect(seriesEvts.filter((e) => e.eventType === 'SOURCE_APPEARED')).toHaveLength(1)
      expect(seriesEvts.filter((e) => e.eventType === 'SOURCE_DISAPPEARED')).toHaveLength(1)
    })

    it('records a new SOURCE_APPEARED when an item reappears after disappearing', async () => {
      const t1 = new Date('2026-05-01T10:00:00Z')
      const t2 = new Date('2026-05-02T10:00:00Z')
      const t3 = new Date('2026-05-03T10:00:00Z')
      const stream = makeVodStream({ stream_id: 503, name: 'Reappearing Lifecycle Movie' })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], t1))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [], t2))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], t3))

      const [movieAv] = await db
        .select()
        .from(movieAvailabilities)
        .where(and(eq(movieAvailabilities.providerItemId, '503'), eq(movieAvailabilities.providerId, testSourceId)))
      const events = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, movieAv.movieId))
      expect(events.filter((e) => e.eventType === 'SOURCE_APPEARED')).toHaveLength(2)
      expect(events.filter((e) => e.eventType === 'SOURCE_DISAPPEARED')).toHaveLength(1)
    })

    it('does not create events for metadata-only updates on an already AVAILABLE item', async () => {
      const t1 = new Date('2026-05-01T10:00:00Z')
      const t2 = new Date('2026-05-02T10:00:00Z')
      const stream = makeVodStream({ stream_id: 504, name: 'Metadata Movie' })
      const streamUpdated = { ...stream, name: 'Metadata Movie Updated' }

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], t1))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([streamUpdated], [], t2))

      const [movieAv] = await db
        .select()
        .from(movieAvailabilities)
        .where(and(eq(movieAvailabilities.providerItemId, '504'), eq(movieAvailabilities.providerId, testSourceId)))
      const events = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, movieAv.movieId))
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('SOURCE_APPEARED')
    })

    it('records exactly one SOURCE_APPEARED event per episode on first episode sync', async () => {
      const t1 = new Date('2026-06-01T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 600, name: 'Lifecycle Episode Series' })
      const info = makeSeriesInfo({
        '1': [
          { id: 'ep-600-1', episode_num: 1, title: 'Ep One' },
          { id: 'ep-600-2', episode_num: 2, title: 'Ep Two' },
        ],
      })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 600: info }))

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)

      for (const row of epAvRows) {
        const events = await db
          .select()
          .from(releaseEvents)
          .where(and(eq(releaseEvents.mediaId, row.episodeId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
        expect(events).toHaveLength(1)
        expect(events[0].sourceId).toBe(testSourceId)
        expect(events[0].occurredAt.toISOString()).toBe(t1.toISOString())
      }
    })

    it('does not create additional episode events when re-syncing with an identical episode snapshot', async () => {
      const t1 = new Date('2026-06-01T10:00:00Z')
      const t2 = new Date('2026-06-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 601, name: 'Stable Lifecycle Episode Series' })
      const info = makeSeriesInfo({ '1': [{ id: 'ep-601-1', episode_num: 1, title: 'Stable Ep' }] })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 601: info }))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t2, { 601: info }))

      const [epAvRow] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      const events = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, epAvRow.episodeId))
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('SOURCE_APPEARED')
    })

    it('records SOURCE_DISAPPEARED when an episode is absent from an authoritative snapshot', async () => {
      const t1 = new Date('2026-06-01T10:00:00Z')
      const t2 = new Date('2026-06-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 602, name: 'Disappearing Episode Series' })

      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, {
          602: makeSeriesInfo({ '1': [{ id: 'ep-602-1', episode_num: 1, title: 'Gone Ep' }] }),
        }),
      )
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2, { 602: makeSeriesInfo({ '1': [] }) }),
      )

      const [epAvRow] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      const events = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, epAvRow.episodeId))
      expect(events.filter((e) => e.eventType === 'SOURCE_APPEARED')).toHaveLength(1)
      const disappeared = events.filter((e) => e.eventType === 'SOURCE_DISAPPEARED')
      expect(disappeared).toHaveLength(1)
      expect(disappeared[0].sourceId).toBe(testSourceId)
      expect(disappeared[0].occurredAt.toISOString()).toBe(t2.toISOString())
    })

    it('records a new SOURCE_APPEARED when an episode reappears after disappearing', async () => {
      const t1 = new Date('2026-06-01T10:00:00Z')
      const t2 = new Date('2026-06-02T10:00:00Z')
      const t3 = new Date('2026-06-03T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 603, name: 'Reappearing Episode Series' })
      const info = makeSeriesInfo({ '1': [{ id: 'ep-603-1', episode_num: 1, title: 'Returning Ep' }] })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 603: info }))
      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2, { 603: makeSeriesInfo({ '1': [] }) }),
      )
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t3, { 603: info }))

      const [epAvRow] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      const events = await db
        .select()
        .from(releaseEvents)
        .where(eq(releaseEvents.mediaId, epAvRow.episodeId))
      expect(events.filter((e) => e.eventType === 'SOURCE_APPEARED')).toHaveLength(2)
      expect(events.filter((e) => e.eventType === 'SOURCE_DISAPPEARED')).toHaveLength(1)
    })

    it('episode events carry the correct sourceId', async () => {
      const t1 = new Date('2026-06-01T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 604, name: 'Source Identity Episode Series' })
      const info = makeSeriesInfo({ '1': [{ id: 'ep-604-1', episode_num: 1, title: 'Ep' }] })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 604: info }))

      const [epAvRow] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      const [event] = await db
        .select()
        .from(releaseEvents)
        .where(and(eq(releaseEvents.mediaId, epAvRow.episodeId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
      expect(event.sourceId).toBe(testSourceId)
    })
  })

  describe('Plex episode lifecycle', () => {
    async function cleanupPlexSource(plexSourceId: string) {
      const epAvRows = await db
        .select({ episodeId: episodeAvailabilities.episodeId })
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, plexSourceId))
      if (epAvRows.length > 0) {
        await db.delete(releaseEvents).where(inArray(releaseEvents.mediaId, epAvRows.map((r) => r.episodeId)))
      }
      const serAvRows = await db
        .select({ seriesId: seriesAvailabilities.seriesId })
        .from(seriesAvailabilities)
        .where(eq(seriesAvailabilities.providerId, plexSourceId))
      if (serAvRows.length > 0) {
        await db.delete(releaseEvents).where(inArray(releaseEvents.mediaId, serAvRows.map((r) => r.seriesId)))
        await db.delete(seriesTable).where(inArray(seriesTable.id, serAvRows.map((r) => r.seriesId)))
      }
      await db.delete(syncRuns).where(eq(syncRuns.sourceId, plexSourceId))
      await db.delete(sources).where(eq(sources.id, plexSourceId))
    }

    it('records SOURCE_APPEARED on first Plex episode sync and does not duplicate on idempotent re-sync', async () => {
      const t1 = new Date('2026-07-01T10:00:00Z')
      const t2 = new Date('2026-07-02T10:00:00Z')
      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Episode Source', type: 'PLEX', baseUrl: 'http://plex-ep.test' })
        .returning()

      try {
        const plexSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt: t1,
          movies: [],
          shows: [{ ratingKey: 'plex-show-700', title: 'Plex Episode Show', Guid: [{ id: 'tmdb://70001' }] }],
          episodes: [
            {
              ratingKey: 'plex-ep-700-1',
              grandparentRatingKey: 'plex-show-700',
              parentIndex: 1,
              index: 1,
              title: 'Plex Pilot',
            },
          ],
        }

        await CatalogSyncService.syncPlexCatalog(plexSource.id, plexSnapshot)

        const epAvRows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, plexSource.id))
        expect(epAvRows).toHaveLength(1)
        expect(epAvRows[0].status).toBe('AVAILABLE')
        expect(epAvRows[0].providerItemId).toBe('plex-ep-700-1')

        const events1 = await db
          .select()
          .from(releaseEvents)
          .where(and(eq(releaseEvents.mediaId, epAvRows[0].episodeId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
        expect(events1).toHaveLength(1)
        expect(events1[0].sourceId).toBe(plexSource.id)
        expect(events1[0].occurredAt.toISOString()).toBe(t1.toISOString())

        // Idempotent re-sync: no duplicate events
        await CatalogSyncService.syncPlexCatalog(plexSource.id, { ...plexSnapshot, fetchedAt: t2 })

        const events2 = await db
          .select()
          .from(releaseEvents)
          .where(and(eq(releaseEvents.mediaId, epAvRows[0].episodeId), eq(releaseEvents.eventType, 'SOURCE_APPEARED')))
        expect(events2).toHaveLength(1)

        const epAvRowsAfter = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, plexSource.id))
        expect(epAvRowsAfter[0].firstSeenAt.toISOString()).toBe(t1.toISOString())
        expect(epAvRowsAfter[0].lastSeenAt.toISOString()).toBe(t2.toISOString())
      } finally {
        await cleanupPlexSource(plexSource.id)
      }
    })

    it('records SOURCE_DISAPPEARED when a Plex episode is absent from a subsequent full snapshot', async () => {
      const t1 = new Date('2026-07-01T10:00:00Z')
      const t2 = new Date('2026-07-02T10:00:00Z')
      const [plexSource] = await db
        .insert(sources)
        .values({ name: 'Plex Disappearing Episode Source', type: 'PLEX', baseUrl: 'http://plex-ep2.test' })
        .returning()

      try {
        const baseSnapshot: PlexCatalogSnapshot = {
          sourceId: plexSource.id,
          fetchedAt: t1,
          movies: [],
          shows: [{ ratingKey: 'plex-show-701', title: 'Plex Disappearing Show', Guid: [{ id: 'tmdb://70002' }] }],
          episodes: [
            { ratingKey: 'plex-ep-701-1', grandparentRatingKey: 'plex-show-701', parentIndex: 1, index: 1, title: 'Keep' },
            { ratingKey: 'plex-ep-701-2', grandparentRatingKey: 'plex-show-701', parentIndex: 1, index: 2, title: 'Gone' },
          ],
        }

        await CatalogSyncService.syncPlexCatalog(plexSource.id, baseSnapshot)

        // Second sync: only the first episode remains
        await CatalogSyncService.syncPlexCatalog(plexSource.id, {
          ...baseSnapshot,
          fetchedAt: t2,
          episodes: [{ ratingKey: 'plex-ep-701-1', grandparentRatingKey: 'plex-show-701', parentIndex: 1, index: 1, title: 'Keep' }],
        })

        const epAvRows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, plexSource.id))
        expect(epAvRows).toHaveLength(2)

        const kept = epAvRows.find((r) => r.providerItemId === 'plex-ep-701-1')!
        const gone = epAvRows.find((r) => r.providerItemId === 'plex-ep-701-2')!

        expect(kept.status).toBe('AVAILABLE')
        expect(gone.status).toBe('UNAVAILABLE')
        expect(gone.unavailableAt!.toISOString()).toBe(t2.toISOString())

        const goneEvents = await db
          .select()
          .from(releaseEvents)
          .where(and(eq(releaseEvents.mediaId, gone.episodeId), eq(releaseEvents.eventType, 'SOURCE_DISAPPEARED')))
        expect(goneEvents).toHaveLength(1)
        expect(goneEvents[0].sourceId).toBe(plexSource.id)
        expect(goneEvents[0].occurredAt.toISOString()).toBe(t2.toISOString())
      } finally {
        await cleanupPlexSource(plexSource.id)
      }
    })
  })

  describe('title-matching pre-pass', () => {
    function makeMockMatchingService(
      responses: Map<string, { matchState: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS'; movieId?: string | null; seriesId?: string | null }>,
    ): TitleMatchingService {
      const mock = {
        matchItem: async (input: MatchItemInput): Promise<MatchResult> => {
          const resp = responses.get(input.providerItemId) ?? { matchState: 'UNMATCHED' as const }
          return {
            id: 'mock-id',
            providerId: input.providerId,
            providerItemId: input.providerItemId,
            matchState: resp.matchState,
            confidence: resp.matchState === 'MATCHED' ? 0.95 : null,
            movieId: resp.movieId ?? null,
            seriesId: resp.seriesId ?? null,
            normalizedTitle: input.rawTitle,
            extractedYear: null,
            candidateCount: resp.matchState === 'UNMATCHED' ? 0 : 2,
            notes: `mock:${resp.matchState}`,
          }
        },
        matchBatch: async (inputs: MatchItemInput[]): Promise<MatchResult[]> => {
          return Promise.all(inputs.map((i) => mock.matchItem(i)))
        },
      } as unknown as TitleMatchingService
      return mock
    }

    it('provider item without TMDB ID, confident match: attaches availability to canonical movie', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const [canonicalMovie] = await db
        .insert(movies)
        .values({ title: 'Dune Part Two', year: 2024, tmdbId: 9438631 })
        .returning()

      try {
        const responses = new Map([
          ['900', { matchState: 'MATCHED' as const, movieId: canonicalMovie.id }],
        ])
        const matchingService = makeMockMatchingService(responses)

        const result = await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot(
            [makeVodStream({ stream_id: 900, name: '4K-FR - Dune Part Two 2024 1080p' })],
            [],
            fetchedAt,
          ),
          { matchingService },
        )

        expect(result.status).toBe('completed')
        expect(result.counts.moviesCreated).toBe(1)
        expect(result.counts.titleMatchedCount).toBe(1)
        expect(result.counts.titleUnmatchedCount).toBe(0)

        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(1)
        expect(avRows[0].movieId).toBe(canonicalMovie.id)
        expect(avRows[0].rawTitle).toBe('4K-FR - Dune Part Two 2024 1080p')

        // Canonical movie row count stays at 1
        const movieRows = await db.select().from(movies).where(eq(movies.tmdbId, 9438631))
        expect(movieRows).toHaveLength(1)
      } finally {
        await db.delete(movies).where(eq(movies.id, canonicalMovie.id))
      }
    })

    it('multiple provider items matching the same canonical movie converge on one movie row', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const [canonicalMovie] = await db
        .insert(movies)
        .values({ title: 'Dune', year: 2021, tmdbId: 9438630 })
        .returning()

      try {
        const responses = new Map([
          ['901', { matchState: 'MATCHED' as const, movieId: canonicalMovie.id }],
          ['902', { matchState: 'MATCHED' as const, movieId: canonicalMovie.id }],
        ])
        const matchingService = makeMockMatchingService(responses)

        const result = await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot(
            [
              makeVodStream({ stream_id: 901, name: 'FR - Dune 2021 4K' }),
              makeVodStream({ stream_id: 902, name: 'EN - Dune 2021 1080p' }),
            ],
            [],
            fetchedAt,
          ),
          { matchingService },
        )

        expect(result.status).toBe('completed')
        expect(result.counts.moviesCreated).toBe(2)
        expect(result.counts.titleMatchedCount).toBe(2)

        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(2)
        expect(avRows[0].movieId).toBe(canonicalMovie.id)
        expect(avRows[1].movieId).toBe(canonicalMovie.id)

        // Only one canonical movie row
        const movieRows = await db.select().from(movies).where(eq(movies.tmdbId, 9438630))
        expect(movieRows).toHaveLength(1)
      } finally {
        await db.delete(movies).where(eq(movies.id, canonicalMovie.id))
      }
    })

    it('ambiguous match result: local UNMATCHED movie created, no false merge', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const [canonicalMovie] = await db
        .insert(movies)
        .values({ title: 'Alien', year: 2024, tmdbId: 9945961 })
        .returning()

      try {
        const responses = new Map([
          ['903', { matchState: 'AMBIGUOUS' as const, movieId: null }],
        ])
        const matchingService = makeMockMatchingService(responses)

        const result = await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot(
            [makeVodStream({ stream_id: 903, name: 'Alien Romulus 2024 4K' })],
            [],
            fetchedAt,
          ),
          { matchingService },
        )

        expect(result.status).toBe('completed')
        expect(result.counts.titleMatchedCount).toBe(0)
        expect(result.counts.titleUnmatchedCount).toBe(1)

        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(1)

        // Must NOT point to the canonical movie — a distinct UNMATCHED row is created
        expect(avRows[0].movieId).not.toBe(canonicalMovie.id)

        const [unmatchedMovie] = await db.select().from(movies).where(eq(movies.id, avRows[0].movieId))
        expect(unmatchedMovie.tmdbId).toBeNull()
        expect(unmatchedMovie.matchStatus).toBe('UNMATCHED')
      } finally {
        await db.delete(movies).where(eq(movies.id, canonicalMovie.id))
      }
    })

    it('zero TMDB candidates: UNMATCHED local movie created and remains playable', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')
      const responses = new Map([
        ['904', { matchState: 'UNMATCHED' as const, movieId: null }],
      ])
      const matchingService = makeMockMatchingService(responses)

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [makeVodStream({ stream_id: 904, name: 'Xzqwerty Unknown 2099 4K' })],
          [],
          fetchedAt,
        ),
        { matchingService },
      )

      expect(result.status).toBe('completed')
      expect(result.counts.titleUnmatchedCount).toBe(1)

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(1)
      expect(avRows[0].status).toBe('AVAILABLE')

      const [movie] = await db.select().from(movies).where(eq(movies.id, avRows[0].movieId))
      expect(movie.tmdbId).toBeNull()
      expect(movie.matchStatus).toBe('UNMATCHED')
    })

    it('TMDB failure during pre-pass: affected item stored as UNMATCHED, sync completes', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const throwingMock = {
        matchItem: async (_input: MatchItemInput): Promise<MatchResult> => {
          throw new Error('TMDB network error')
        },
        matchBatch: async (inputs: MatchItemInput[]): Promise<MatchResult[]> => {
          return Promise.all(inputs.map((i) => throwingMock.matchItem(i)))
        },
      } as unknown as TitleMatchingService

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [makeVodStream({ stream_id: 905, name: 'Some Movie 2024 1080p' })],
          [],
          fetchedAt,
        ),
        { matchingService: throwingMock },
      )

      // Sync must complete despite TMDB failure
      expect(result.status).toBe('completed')

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(1)
      expect(avRows[0].status).toBe('AVAILABLE')

      const [movie] = await db.select().from(movies).where(eq(movies.id, avRows[0].movieId))
      expect(movie.tmdbId).toBeNull()
      expect(movie.matchStatus).toBe('UNMATCHED')
    })

    it('re-sync with identical snapshot is idempotent when matching service is provided', async () => {
      const fetchedAt1 = new Date('2026-08-01T10:00:00Z')
      const fetchedAt2 = new Date('2026-08-02T10:00:00Z')

      const [canonicalMovie] = await db
        .insert(movies)
        .values({ title: 'Oppenheimer', year: 2023, tmdbId: 9872585 })
        .returning()

      try {
        const responses = new Map([
          ['906', { matchState: 'MATCHED' as const, movieId: canonicalMovie.id }],
        ])
        const matchingService = makeMockMatchingService(responses)
        const stream = makeVodStream({ stream_id: 906, name: 'Oppenheimer 2023 4K' })

        await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], fetchedAt1), { matchingService })
        await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([stream], [], fetchedAt2), { matchingService })

        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(1)
        expect(avRows[0].movieId).toBe(canonicalMovie.id)
        expect(avRows[0].firstSeenAt.toISOString()).toBe(fetchedAt1.toISOString())
        expect(avRows[0].lastSeenAt.toISOString()).toBe(fetchedAt2.toISOString())

        // No duplicate movie rows
        const movieRows = await db.select().from(movies).where(eq(movies.tmdbId, 9872585))
        expect(movieRows).toHaveLength(1)
      } finally {
        await db.delete(movies).where(eq(movies.id, canonicalMovie.id))
      }
    })

    it('movies.matchStatus is MATCHED for TMDB-resolved items and UNMATCHED for local skeletons', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [
            makeVodStream({ stream_id: 907, name: 'Movie With TMDB', tmdb: '999001' }),
            makeVodStream({ stream_id: 908, name: 'Movie Without TMDB' }),
          ],
          [],
          fetchedAt,
        ),
      )

      expect(result.status).toBe('completed')

      const avRows = await db
        .select({ movieId: movieAvailabilities.movieId, providerItemId: movieAvailabilities.providerItemId })
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))

      const withTmdb = avRows.find((r) => r.providerItemId === '907')!
      const withoutTmdb = avRows.find((r) => r.providerItemId === '908')!

      const [movieMatched] = await db.select().from(movies).where(eq(movies.id, withTmdb.movieId))
      const [movieUnmatched] = await db.select().from(movies).where(eq(movies.id, withoutTmdb.movieId))

      expect(movieMatched.matchStatus).toBe('MATCHED')
      expect(movieMatched.tmdbId).toBe(999001)
      expect(movieUnmatched.matchStatus).toBe('UNMATCHED')
      expect(movieUnmatched.tmdbId).toBeNull()
    })

    it('series without TMDB ID is matched via title matching service', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const [canonicalSeries] = await db
        .insert(seriesTable)
        .values({ title: 'Severance', firstAirYear: 2022, tmdbId: 9095396 })
        .returning()

      try {
        const responses = new Map([
          ['910', { matchState: 'MATCHED' as const, seriesId: canonicalSeries.id }],
        ])
        const matchingService = makeMockMatchingService(responses)

        const result = await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot(
            [],
            [makeSeriesEntry({ series_id: 910, name: 'FR - Severance S01 2022' })],
            fetchedAt,
          ),
          { matchingService },
        )

        expect(result.status).toBe('completed')
        expect(result.counts.titleMatchedCount).toBe(1)

        const avRows = await db
          .select()
          .from(seriesAvailabilities)
          .where(eq(seriesAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(1)
        expect(avRows[0].seriesId).toBe(canonicalSeries.id)
      } finally {
        await db.delete(seriesTable).where(eq(seriesTable.id, canonicalSeries.id))
      }
    })

    it('movie without TMDB ID and no matching service creates UNMATCHED skeleton (backward compat)', async () => {
      const fetchedAt = new Date('2026-08-01T10:00:00Z')

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [makeVodStream({ stream_id: 909, name: 'Unknown Movie 2099 4K' })],
          [],
          fetchedAt,
        ),
      )

      expect(result.status).toBe('completed')
      expect(result.counts.titleMatchedCount).toBe(0)
      expect(result.counts.titleUnmatchedCount).toBe(0)

      const avRows = await db
        .select()
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.providerId, testSourceId))
      expect(avRows).toHaveLength(1)
      expect(avRows[0].status).toBe('AVAILABLE')

      const [movie] = await db.select().from(movies).where(eq(movies.id, avRows[0].movieId))
      expect(movie.tmdbId).toBeNull()
      expect(movie.matchStatus).toBe('UNMATCHED')
    })
  })

  describe('episode variant field propagation', () => {
    it('stores rawTitle, audioLanguage, videoQuality, containerExtension on episodeAvailabilities', async () => {
      const t1 = new Date('2026-09-01T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 1001, name: '4K-FR - Test Series' })
      const info: XtreamSeriesInfo = {
        info: {
          name: 'Test Series',
          cover: '',
          plot: '',
          cast: '',
          director: '',
          genre: '',
          releaseDate: '',
          last_modified: '',
          rating: '0',
          rating_5based: 0,
          backdrop_path: [],
          youtube_trailer: '',
          episode_run_time: '',
          category_id: '1',
          category_name: '',
        },
        episodes: {
          '1': [
            {
              id: 'ep-1001-1',
              episode_num: 1,
              title: '4K - Pilot',
              container_extension: 'mkv',
              info: { duration_secs: 2700, duration: '00:45:00', releasedate: '2024-03-01' },
            },
          ],
        },
      }

      const result = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, { 1001: info }),
      )

      expect(result.status).toBe('completed')

      const [epAv] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerItemId, 'ep-1001-1'))

      expect(epAv).toBeDefined()
      expect(epAv.rawTitle).toBe('4K - Pilot')
      expect(epAv.containerExtension).toBe('mkv')
      // normalizeTitle extracts quality signals from the raw title
      expect(epAv.videoQuality).toBe('4K')
    })

    it('updates variant fields on episodeAvailabilities on subsequent syncs', async () => {
      const t1 = new Date('2026-09-01T10:00:00Z')
      const t2 = new Date('2026-09-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 1002, name: 'Update Series' })
      const makeInfo = (ext: string): XtreamSeriesInfo => ({
        info: {
          name: '',
          cover: '',
          plot: '',
          cast: '',
          director: '',
          genre: '',
          releaseDate: '',
          last_modified: '',
          rating: '0',
          rating_5based: 0,
          backdrop_path: [],
          youtube_trailer: '',
          episode_run_time: '',
          category_id: '1',
          category_name: '',
        },
        episodes: {
          '1': [
            {
              id: 'ep-1002-1',
              episode_num: 1,
              title: 'Ep1',
              container_extension: ext,
              info: { duration_secs: 1800, duration: '00:30:00' },
            },
          ],
        },
      })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 1002: makeInfo('mp4') }))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t2, { 1002: makeInfo('mkv') }))

      const [epAv] = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerItemId, 'ep-1002-1'))

      expect(epAv.containerExtension).toBe('mkv')
    })

    it('multi-variant: two streams for the same episode create one episode row and two availability rows', async () => {
      const t1 = new Date('2026-09-01T10:00:00Z')
      const [secondSource] = await db
        .insert(sources)
        .values({ name: 'Multi-Variant Source', type: 'XTREAM', baseUrl: 'http://mv.example.com', username: 'u', password: 'p' })
        .returning()

      const [canonicalSeries] = await db
        .insert(seriesTable)
        .values({ title: 'Multi-Variant Series' })
        .returning()

      try {
        await db.insert(seriesAvailabilities).values([
          { seriesId: canonicalSeries.id, providerId: testSourceId, providerItemId: '1003', firstSeenAt: t1, lastSeenAt: t1, status: 'AVAILABLE' },
          { seriesId: canonicalSeries.id, providerId: secondSource.id, providerItemId: '1003', firstSeenAt: t1, lastSeenAt: t1, status: 'AVAILABLE' },
        ])

        const makeMultiInfo = (epId: string): XtreamSeriesInfo => ({
          info: {
            name: '',
            cover: '',
            plot: '',
            cast: '',
            director: '',
            genre: '',
            releaseDate: '',
            last_modified: '',
            rating: '0',
            rating_5based: 0,
            backdrop_path: [],
            youtube_trailer: '',
            episode_run_time: '',
            category_id: '1',
            category_name: '',
          },
          episodes: {
            '1': [
              {
                id: epId,
                episode_num: 3,
                title: 'S01E03',
                container_extension: 'mkv',
                info: { duration_secs: 2700, duration: '00:45:00' },
              },
            ],
          },
        })

        await CatalogSyncService.syncCatalog(
          testSourceId,
          makeSnapshot([], [makeSeriesEntry({ series_id: 1003, name: 'Multi-Variant Series' })], t1, {
            1003: makeMultiInfo('ep-1003-s1'),
          }),
        )
        await CatalogSyncService.syncCatalog(
          secondSource.id,
          {
            sourceId: secondSource.id,
            fetchedAt: t1,
            vodCategories: [],
            vodStreams: [],
            seriesCategories: [],
            series: [makeSeriesEntry({ series_id: 1003, name: 'Multi-Variant Series' })],
            seriesInfo: { 1003: makeMultiInfo('ep-1003-s2') },
          },
        )

        const s1Rows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, testSourceId))
        const s2Rows = await db
          .select()
          .from(episodeAvailabilities)
          .where(eq(episodeAvailabilities.providerId, secondSource.id))

        expect(s1Rows).toHaveLength(1)
        expect(s2Rows).toHaveLength(1)
        // Both availabilities must point to the same canonical episode
        expect(s1Rows[0].episodeId).toBe(s2Rows[0].episodeId)
        expect(s1Rows[0].providerItemId).toBe('ep-1003-s1')
        expect(s2Rows[0].providerItemId).toBe('ep-1003-s2')
      } finally {
        await db.delete(seriesAvailabilities).where(eq(seriesAvailabilities.providerId, secondSource.id))
        await db.delete(syncRuns).where(eq(syncRuns.sourceId, secondSource.id))
        await db.delete(sources).where(eq(sources.id, secondSource.id))
        // canonical series cleaned up by afterEach cascade
      }
    })

    it('idempotency: re-running sync with identical episode data does not add rows', async () => {
      const t1 = new Date('2026-09-01T10:00:00Z')
      const t2 = new Date('2026-09-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 1004, name: 'Idempotent Series' })
      const info = makeSeriesInfo({
        '1': [
          { id: 'ep-1004-1', episode_num: 1, title: 'Ep One' },
          { id: 'ep-1004-2', episode_num: 2, title: 'Ep Two' },
        ],
      })

      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t1, { 1004: info }))
      await CatalogSyncService.syncCatalog(testSourceId, makeSnapshot([], [seriesEntry], t2, { 1004: info }))

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)
      for (const row of epAvRows) {
        expect(row.status).toBe('AVAILABLE')
      }
    })

    it('newly-added episode appears as AVAILABLE after a subsequent sync', async () => {
      const t1 = new Date('2026-09-01T10:00:00Z')
      const t2 = new Date('2026-09-02T10:00:00Z')
      const seriesEntry = makeSeriesEntry({ series_id: 1005, name: 'Growing Series' })

      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t1, {
          1005: makeSeriesInfo({ '1': [{ id: 'ep-1005-1', episode_num: 1, title: 'Ep One' }] }),
        }),
      )

      await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot([], [seriesEntry], t2, {
          1005: makeSeriesInfo({
            '1': [
              { id: 'ep-1005-1', episode_num: 1, title: 'Ep One' },
              { id: 'ep-1005-2', episode_num: 2, title: 'Ep Two (new)' },
            ],
          }),
        }),
      )

      const epAvRows = await db
        .select()
        .from(episodeAvailabilities)
        .where(eq(episodeAvailabilities.providerId, testSourceId))
      expect(epAvRows).toHaveLength(2)

      const newEp = epAvRows.find((r) => r.providerItemId === 'ep-1005-2')!
      expect(newEp.status).toBe('AVAILABLE')
      expect(newEp.firstSeenAt.toISOString()).toBe(t2.toISOString())
    })
  })
})
