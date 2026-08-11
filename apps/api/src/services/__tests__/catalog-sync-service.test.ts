import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { sources } from '../../db/schema/sources.js'
import { movieAvailabilities, seriesAvailabilities } from '../../db/schema/availabilities.js'
import { syncRuns } from '../../db/schema/sync-runs.js'
import { CatalogSyncService, SyncAlreadyRunningError } from '../catalog-sync-service.js'
import type { XtreamCatalogSnapshot, XtreamVodStream, XtreamSeries } from '../../providers/xtream/types.js'

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
): XtreamCatalogSnapshot {
  return {
    sourceId: testSourceId,
    fetchedAt,
    vodCategories: [],
    vodStreams,
    seriesCategories: [],
    series: seriesEntries,
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
    it('leaves no orphan rows and no stale RUNNING lock after a failed sync', async () => {
      const conflictTmdbId = 88001
      const fetchedAt = new Date('2026-01-01T10:00:00Z')

      // Pre-insert a movie that will conflict with the incoming stream's tmdbId
      const [conflictingMovie] = await db
        .insert(movies)
        .values({ title: 'Pre-existing Movie', tmdbId: conflictTmdbId })
        .returning()

      try {
        const snapshot = makeSnapshot(
          [makeVodStream({ stream_id: 7, name: 'Conflict Movie', tmdb: String(conflictTmdbId) })],
          [],
          fetchedAt,
        )

        const result = await CatalogSyncService.syncCatalog(testSourceId, snapshot)

        // The sync should fail because of the tmdbId constraint violation
        expect(result.status).toBe('failed')

        // No orphan availability rows created by the failed sync
        const avRows = await db
          .select()
          .from(movieAvailabilities)
          .where(eq(movieAvailabilities.providerId, testSourceId))
        expect(avRows).toHaveLength(0)

        // syncRuns must not be left as RUNNING
        const runs = await db.select().from(syncRuns).where(eq(syncRuns.sourceId, testSourceId))
        expect(runs.every((r) => r.status !== 'RUNNING')).toBe(true)
        expect(runs.some((r) => r.status === 'FAILED')).toBe(true)
      } finally {
        await db.delete(movies).where(eq(movies.id, conflictingMovie.id))
      }

      // Retry with a clean snapshot (no conflicting tmdbId) — must succeed
      const retryResult = await CatalogSyncService.syncCatalog(
        testSourceId,
        makeSnapshot(
          [makeVodStream({ stream_id: 7, name: 'Fixed Movie', tmdb: '' })],
          [],
          new Date('2026-01-01T11:00:00Z'),
        ),
      )
      expect(retryResult.status).toBe('completed')
      expect(retryResult.counts.moviesCreated).toBe(1)
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
})
