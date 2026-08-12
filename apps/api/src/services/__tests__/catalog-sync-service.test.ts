import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { sources } from '../../db/schema/sources.js'
import { movieAvailabilities, seriesAvailabilities, episodeAvailabilities } from '../../db/schema/availabilities.js'
import { syncRuns } from '../../db/schema/sync-runs.js'
import { CatalogSyncService, SyncAlreadyRunningError } from '../catalog-sync-service.js'
import type { XtreamCatalogSnapshot, XtreamVodStream, XtreamSeries, XtreamSeriesInfo } from '../../providers/xtream/types.js'

let testSourceId: string

function makeVodStream(overrides: Partial<XtreamVodStream> & { stream_id: number; name: string }): XtreamVodStream {
  return {
    num: overrides.stream_id,
    name: overrides.name,
    stream_id: overrides.stream_id,
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
    series_id: overrides.series_id,
    name: overrides.name,
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
    await db.delete(movies).where(inArray(movies.id, movieRows.map((r) => r.movieId)))
  }

  const seriesRows = await db
    .select({ seriesId: seriesAvailabilities.seriesId })
    .from(seriesAvailabilities)
    .where(eq(seriesAvailabilities.providerId, testSourceId))
  if (seriesRows.length > 0) {
    // cascade: series → seasons → episodes → episodeAvailabilities
    await db.delete(seriesTable).where(inArray(seriesTable.id, seriesRows.map((r) => r.seriesId)))
  }

  await db.delete(syncRuns).where(eq(syncRuns.sourceId, testSourceId))
})

describe('CatalogSyncService', () => {
  describe('first sync', () => {
    it('creates movies, availabilities, series, and a COMPLETED sync run', async () => {
      const fetchedAt = new Date('2026-01-01T10:00:00Z')
      const snapshot = makeSnapshot(
        [
          makeVodStream({ stream_id: 1, name: 'Movie Alpha', tmdb: '111', plot: 'A plot' }),
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
      expect(movie1.tmdbId).toBe(111)
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
  })
})
