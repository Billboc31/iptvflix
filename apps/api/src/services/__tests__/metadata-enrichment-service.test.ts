import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetadataEnrichmentService } from '../metadata-enrichment-service.js'
import type { MetadataProvider, ExternalMovieMetadata, ExternalSeriesMetadata, ExternalSeasonEpisode } from '../../providers/metadata/types.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../../db/schema/index.js'

type Db = PostgresJsDatabase<typeof schema>

const MOVIE_ID = 'movie-uuid-1'
const SERIES_ID = 'series-uuid-1'
const TMDB_MOVIE_ID = 603
const TMDB_SERIES_ID = 1396

const freshEnrichedAt = new Date()
const staleEnrichedAt = new Date(Date.now() - 10 * 86_400_000)

const movieMetadata: ExternalMovieMetadata = {
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  year: 1999,
  synopsis: 'A hacker discovers the truth.',
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  genres: ['Action', 'Science Fiction'],
  runtimeMinutes: 136,
  imdbId: 'tt0133093',
  popularity: 64.5,
  voteAverage: 8.2,
  certification: null,
}

const seriesMetadata: ExternalSeriesMetadata = {
  title: 'Breaking Bad',
  originalTitle: 'Breaking Bad',
  firstAirYear: 2008,
  synopsis: 'A chemistry teacher turns to crime.',
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  genres: ['Drama', 'Crime'],
  imdbId: null,
  popularity: 93.2,
  voteAverage: 9.5,
  certification: null,
  status: null,
}

function makeSelectChain(resolvedValue: unknown) {
  const whereWrap = vi.fn().mockResolvedValue(resolvedValue)
  const fromWrap = vi.fn().mockReturnValue({ where: whereWrap })
  return { select: vi.fn().mockReturnValue({ from: fromWrap }), where: whereWrap, from: fromWrap }
}

function makeUpdateChain() {
  const whereWrap = vi.fn().mockResolvedValue(undefined)
  const setWrap = vi.fn().mockReturnValue({ where: whereWrap })
  return { update: vi.fn().mockReturnValue({ set: setWrap }), where: whereWrap, set: setWrap }
}

function makeInsertChain(onConflictResult: unknown = []) {
  const onConflictDoNothing = vi.fn().mockResolvedValue(onConflictResult)
  const onConflictDoUpdate = vi.fn().mockResolvedValue([])
  const returning = vi.fn().mockResolvedValue([])
  const valuesWithAll = vi.fn().mockReturnValue({ onConflictDoNothing, onConflictDoUpdate, returning })
  return {
    insert: vi.fn().mockReturnValue({ values: valuesWithAll }),
    values: valuesWithAll,
    onConflictDoNothing,
    onConflictDoUpdate,
  }
}

function makeDeleteChain() {
  const whereWrap = vi.fn().mockResolvedValue(undefined)
  return { delete: vi.fn().mockReturnValue({ where: whereWrap }), where: whereWrap }
}

function makeProvider(overrides: Partial<MetadataProvider> = {}): MetadataProvider {
  return {
    getMovieMetadata: vi.fn().mockResolvedValue(movieMetadata),
    getSeriesMetadata: vi.fn().mockResolvedValue(seriesMetadata),
    searchMovies: vi.fn().mockResolvedValue([]),
    searchSeries: vi.fn().mockResolvedValue([]),
    fetchMovieFeed: vi.fn().mockResolvedValue([]),
    fetchSeriesFeed: vi.fn().mockResolvedValue([]),
    fetchMovieTopRated: vi.fn().mockResolvedValue([]),
    fetchSeriesTopRated: vi.fn().mockResolvedValue([]),
    fetchMovieDiscover: vi.fn().mockResolvedValue([]),
    fetchSeriesDiscover: vi.fn().mockResolvedValue([]),
    getMovieVideos: vi.fn().mockResolvedValue([]),
    getSeriesVideos: vi.fn().mockResolvedValue([]),
    getMovieCredits: vi.fn().mockResolvedValue([]),
    getSeriesCredits: vi.fn().mockResolvedValue([]),
    getMovieCertification: vi.fn().mockResolvedValue(null),
    getSeriesCertification: vi.fn().mockResolvedValue(null),
    getSeasonEpisodes: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('MetadataEnrichmentService', () => {
  describe('enrichMovie()', () => {
    it('returns no-tmdb-id when movie not found', async () => {
      const selectChain = makeSelectChain([])
      const db = { ...selectChain } as unknown as Db
      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('no-tmdb-id')
    })

    it('returns no-tmdb-id when movie has null tmdbId', async () => {
      const row = { id: MOVIE_ID, tmdbId: null, metadataEnrichedAt: null }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('no-tmdb-id')
    })

    it('returns skipped when metadataEnrichedAt is within stale window', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: freshEnrichedAt }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const provider = makeProvider()
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('skipped')
      expect(provider.getMovieMetadata).not.toHaveBeenCalled()
    })

    it('enriches when metadataEnrichedAt is null', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }

      let selectCallIdx = 0
      const selectResults = [[row], [{ id: 'genre-1', slug: 'action' }, { id: 'genre-2', slug: 'science-fiction' }]]

      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const updateChain = makeUpdateChain()
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('enriched')
      expect(updateChain.update).toHaveBeenCalled()
    })

    it('enriches when metadataEnrichedAt is stale', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: staleEnrichedAt }

      let selectCallIdx = 0
      const selectResults = [[row], [{ id: 'genre-1', slug: 'action' }]]

      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })
      const updateChain = makeUpdateChain()
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('enriched')
    })

    it('returns enriched when force=true even if fresh', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: freshEnrichedAt }

      let selectCallIdx = 0
      const selectResults = [[row], [{ id: 'genre-1', slug: 'action' }]]
      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })
      const updateChain = makeUpdateChain()
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichMovie(MOVIE_ID, { force: true })
      expect(result).toBe('enriched')
    })

    it('returns terminal-failed when provider returns null (404)', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null, title: 'Test' }
      const selectChain = makeSelectChain([row])
      const insertChain = makeInsertChain()
      const db = { ...selectChain, insert: insertChain.insert } as unknown as Db
      const provider = makeProvider({ getMovieMetadata: vi.fn().mockResolvedValue(null) })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('terminal-failed')
    })

    it('returns terminal-failed when provider throws a non-transient error', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null, title: 'Test' }
      const selectChain = makeSelectChain([row])
      const insertChain = makeInsertChain()
      const db = { ...selectChain, insert: insertChain.insert } as unknown as Db
      const provider = makeProvider({
        getMovieMetadata: vi.fn().mockRejectedValue(new Error('network failure')),
      })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichMovie(MOVIE_ID)
      // Generic Error has no transient code/class — classified as terminal
      expect(result).toBe('terminal-failed')
    })

    it('writes metadataProvider=tmdb and metadataEnrichedAt', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }

      let selectCallIdx = 0
      const selectResults = [[row], []]
      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const whereUpdate = vi.fn().mockResolvedValue(undefined)
      const setMock = vi.fn().mockReturnValue({ where: whereUpdate })
      const updateMock = vi.fn().mockReturnValue({ set: setMock })
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateMock,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      await service.enrichMovie(MOVIE_ID)

      const setArgs = setMock.mock.calls[0][0] as Record<string, unknown>
      expect(setArgs.metadataProvider).toBe('tmdb')
      expect(setArgs.metadataEnrichedAt).toBeInstanceOf(Date)
    })

    it('upserts genres and links them to the movie', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }
      const genreRows = [
        { id: 'genre-action', slug: 'action' },
        { id: 'genre-scifi', slug: 'science-fiction' },
      ]

      let selectCallIdx = 0
      const selectResults = [[row], genreRows]
      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const updateChain = makeUpdateChain()
      const whereDelete = vi.fn().mockResolvedValue(undefined)
      const deleteMock = vi.fn().mockReturnValue({ where: whereDelete })

      const onConflictDoNothing = vi.fn().mockResolvedValue([])
      const returning = vi.fn().mockResolvedValue([])
      const valuesInsert = vi.fn().mockReturnValue({ onConflictDoNothing, returning })
      const insertMock = vi.fn().mockReturnValue({ values: valuesInsert })

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertMock,
        delete: deleteMock,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      await service.enrichMovie(MOVIE_ID)

      expect(onConflictDoNothing).toHaveBeenCalled()
      expect(whereDelete).toHaveBeenCalled()
      expect(insertMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('enrichSeries()', () => {
    it('returns no-tmdb-id when series has null tmdbId', async () => {
      const row = { id: SERIES_ID, tmdbId: null, metadataEnrichedAt: null }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichSeries(SERIES_ID)
      expect(result).toBe('no-tmdb-id')
    })

    it('returns skipped when series is fresh', async () => {
      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: freshEnrichedAt }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const provider = makeProvider()
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichSeries(SERIES_ID)
      expect(result).toBe('skipped')
      expect(provider.getSeriesMetadata).not.toHaveBeenCalled()
    })

    it('enriches series with metadataProvider=tmdb', async () => {
      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null }

      let selectCallIdx = 0
      const selectResults = [[row], [{ id: 'genre-drama', slug: 'drama' }]]
      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const whereUpdate = vi.fn().mockResolvedValue(undefined)
      const setMock = vi.fn().mockReturnValue({ where: whereUpdate })
      const updateMock = vi.fn().mockReturnValue({ set: setMock })
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateMock,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichSeries(SERIES_ID)
      expect(result).toBe('enriched')
      const setArgs = setMock.mock.calls[0][0] as Record<string, unknown>
      expect(setArgs.metadataProvider).toBe('tmdb')
    })

    it('returns terminal-failed when provider throws a non-transient error', async () => {
      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null, title: 'Test Series' }
      const selectChain = makeSelectChain([row])
      const insertChain = makeInsertChain()
      const db = { ...selectChain, insert: insertChain.insert } as unknown as Db
      const provider = makeProvider({
        getSeriesMetadata: vi.fn().mockRejectedValue(new Error('network')),
      })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichSeries(SERIES_ID)
      // Generic Error has no transient code/class — classified as terminal
      expect(result).toBe('terminal-failed')
    })

    it('upserts seasons when series has no existing season rows', async () => {
      const seriesMetaWithSeasons: ExternalSeriesMetadata = {
        ...seriesMetadata,
        seasons: [
          { tmdbId: 501, seasonNumber: 1, name: 'Season 1', airDate: '2023-01-01', posterPath: null, episodeCount: 8 },
        ],
      }

      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null }
      let selectCallIdx = 0
      const selectResults = [
        [row],
        [{ id: 'g1', slug: 'drama' }],
        // enrichSeriesSeasons: series lookup
        [{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }],
        // enrichSeriesSeasons: no seasons yet
        [],
      ]
      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const onConflictDoUpdate = vi.fn().mockResolvedValue([])
      const onConflictDoNothing = vi.fn().mockResolvedValue([])
      const returning = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate, onConflictDoNothing, returning })
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

      const whereUpdate = vi.fn().mockResolvedValue(undefined)
      const setMock = vi.fn().mockReturnValue({ where: whereUpdate })
      const updateMock = vi.fn().mockReturnValue({ set: setMock })
      const whereDelete = vi.fn().mockResolvedValue(undefined)
      const deleteMock = vi.fn().mockReturnValue({ where: whereDelete })

      const mockDb = {
        select: selectMock,
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      } as unknown as Db

      const provider = makeProvider({
        getSeriesMetadata: vi.fn().mockResolvedValue(seriesMetaWithSeasons),
      })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeries(SERIES_ID)

      expect(result).toBe('enriched')
      // insert was called for the season upsert
      expect(insertMock).toHaveBeenCalled()
      expect(onConflictDoUpdate).toHaveBeenCalled()
    })

    it('enrichSeries() called twice produces no duplicate seasons (idempotent upsert)', async () => {
      const seriesMetaWithSeasons: ExternalSeriesMetadata = {
        ...seriesMetadata,
        seasons: [
          { tmdbId: 501, seasonNumber: 1, name: 'Season 1', airDate: '2023-01-01', posterPath: null, episodeCount: 8 },
        ],
      }

      // Both calls go through the same mock; onConflictDoUpdate handles deduplication in real DB
      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null }

      function buildMockDb() {
        let selectCallIdx = 0
        const selectResults = [
          [row],
          [{ id: 'g1', slug: 'drama' }],
          [{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }],
          [],
        ]
        const whereMock = vi.fn().mockImplementation(() => Promise.resolve(selectResults[selectCallIdx++] ?? []))
        const fromMock = vi.fn().mockReturnValue({ where: whereMock })
        const selectMock = vi.fn().mockReturnValue({ from: fromMock })
        const onConflictDoUpdate = vi.fn().mockResolvedValue([])
        const onConflictDoNothing = vi.fn().mockResolvedValue([])
        const returning = vi.fn().mockResolvedValue([])
        const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate, onConflictDoNothing, returning })
        const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
        const whereUpdate = vi.fn().mockResolvedValue(undefined)
        const setMock = vi.fn().mockReturnValue({ where: whereUpdate })
        const updateMock = vi.fn().mockReturnValue({ set: setMock })
        const whereDelete = vi.fn().mockResolvedValue(undefined)
        const deleteMock = vi.fn().mockReturnValue({ where: whereDelete })
        return {
          db: { select: selectMock, insert: insertMock, update: updateMock, delete: deleteMock } as unknown as Db,
          onConflictDoUpdate,
        }
      }

      const provider = makeProvider({
        getSeriesMetadata: vi.fn().mockResolvedValue(seriesMetaWithSeasons),
      })

      const { db: db1, onConflictDoUpdate: ocd1 } = buildMockDb()
      const svc1 = new MetadataEnrichmentService(db1, provider)
      await svc1.enrichSeries(SERIES_ID)

      const { db: db2, onConflictDoUpdate: ocd2 } = buildMockDb()
      const svc2 = new MetadataEnrichmentService(db2, provider)
      await svc2.enrichSeries(SERIES_ID)

      // Both calls use onConflictDoUpdate — the DB enforces uniqueness, no duplicates
      expect(ocd1).toHaveBeenCalled()
      expect(ocd2).toHaveBeenCalled()
    })
  })

  describe('enrichPending()', () => {
    it('returns counters with enriched movies and series', async () => {
      const movieRow = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }
      const seriesRow = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null }

      let callIdx = 0
      const callResults = [
        [{ id: MOVIE_ID }],
        [{ id: SERIES_ID }],
        [movieRow],
        [{ id: 'g1', slug: 'action' }],
        [seriesRow],
        [{ id: 'g2', slug: 'drama' }],
      ]

      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(callResults[callIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })
      const updateChain = makeUpdateChain()
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      vi.useFakeTimers()
      const service = new MetadataEnrichmentService(db, makeProvider(), 7)
      const promise = service.enrichPending()
      await vi.runAllTimersAsync()
      const result = await promise
      vi.useRealTimers()

      expect(result.movies.enriched).toBe(1)
      expect(result.series.enriched).toBe(1)
      expect(result.movies.failed).toBe(0)
      expect(result.series.failed).toBe(0)
    })

    it('counts provider-failed items without aborting the batch', async () => {
      const movieRow = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }

      let callIdx = 0
      const callResults = [
        [{ id: MOVIE_ID }],
        [],
        [movieRow],
      ]

      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(callResults[callIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })
      const updateChain = makeUpdateChain()
      const insertChain = makeInsertChain()
      const deleteChain = makeDeleteChain()

      const db = {
        select: selectMock,
        update: updateChain.update,
        insert: insertChain.insert,
        delete: deleteChain.delete,
      } as unknown as Db

      const failingProvider = makeProvider({
        getMovieMetadata: vi.fn().mockRejectedValue(new Error('network')),
      })

      const service = new MetadataEnrichmentService(db, failingProvider)
      const result = await service.enrichPending()
      expect(result.movies.failed).toBe(1)
      expect(result.movies.enriched).toBe(0)
    })
  })

  describe('enrichSeriesSeasons()', () => {
    const SEASON_ID = 'season-uuid-1'
    const EPISODE_ID = 'episode-uuid-1'

    it('returns no-tmdb-id when series has null tmdbId', async () => {
      const row = { id: SERIES_ID, tmdbId: null }
      const whereMock = vi.fn().mockResolvedValue([row])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const db = { select: selectMock } as unknown as Db
      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichSeriesSeasons(SERIES_ID)
      expect(result.result).toBe('no-tmdb-id')
    })

    it('returns no-tmdb-id when series row is not found', async () => {
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockReturnValue({ from: fromMock })

      const db = { select: selectMock } as unknown as Db
      const service = new MetadataEnrichmentService(db, makeProvider())
      const result = await service.enrichSeriesSeasons(SERIES_ID)
      expect(result.result).toBe('no-tmdb-id')
    })

    it('upserts episode row via INSERT ... ON CONFLICT for a TMDB episode', async () => {
      const tmdbEpisodes: ExternalSeasonEpisode[] = [
        { episodeNumber: 1, title: 'Pilot (TMDB)', synopsis: 'Synop', airDate: '2024-01-15', runtimeMinutes: 45, stillPath: null },
      ]

      let selectCall = 0
      const smartSelect = vi.fn().mockImplementation(() => {
        const callNum = selectCall++
        if (callNum === 0) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }]) }) }
        }
        // seasons lookup
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SEASON_ID, seasonNumber: 1 }]) }) }
      })

      const onConflictDoUpdate = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate })
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

      const mockDb = {
        select: smartSelect,
        insert: insertMock,
      } as unknown as Db

      const provider = makeProvider({
        getSeasonEpisodes: vi.fn().mockResolvedValue(tmdbEpisodes),
      })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeriesSeasons(SERIES_ID)

      expect(result.result).toBe('enriched')
      expect(result.episodes.enriched).toBe(1)
      expect(provider.getSeasonEpisodes).toHaveBeenCalledWith(TMDB_SERIES_ID, 1)
      expect(insertMock).toHaveBeenCalled()
      const insertValues = valuesMock.mock.calls[0][0] as Record<string, unknown>
      expect(insertValues.episodeNumber).toBe(1)
      expect(insertValues.title).toBe('Pilot (TMDB)')
      expect(insertValues.synopsis).toBe('Synop')
      expect(insertValues.airDate).toBe('2024-01-15')
      expect(onConflictDoUpdate).toHaveBeenCalled()
    })

    it('creates a new episode row for a TMDB episode that had no prior DB row', async () => {
      let selectCall = 0
      const smartSelect = vi.fn().mockImplementation(() => {
        const callNum = selectCall++
        if (callNum === 0) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }]) }) }
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SEASON_ID, seasonNumber: 1 }]) }) }
      })

      const onConflictDoUpdate = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate })
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

      const mockDb = {
        select: smartSelect,
        insert: insertMock,
      } as unknown as Db

      const provider = makeProvider({
        getSeasonEpisodes: vi.fn().mockResolvedValue([
          { episodeNumber: 99, title: 'New Episode', synopsis: null, airDate: null, runtimeMinutes: null, stillPath: null },
        ]),
      })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeriesSeasons(SERIES_ID)

      expect(result.result).toBe('enriched')
      expect(result.episodes.enriched).toBe(1)
      // Insert is always called — upsert handles both create and update cases
      expect(insertMock).toHaveBeenCalled()
      expect(onConflictDoUpdate).toHaveBeenCalled()
    })

    it('enriches source-free series: creates seasons and episodes with no prior DB rows', async () => {
      const tmdbEpisodes: ExternalSeasonEpisode[] = [
        { episodeNumber: 1, title: 'Ep 1', synopsis: null, airDate: '2024-02-01', runtimeMinutes: 30, stillPath: null, tmdbId: 9001 },
        { episodeNumber: 2, title: 'Ep 2', synopsis: null, airDate: '2024-02-08', runtimeMinutes: 30, stillPath: null, tmdbId: 9002 },
      ]

      let selectCall = 0
      const smartSelect = vi.fn().mockImplementation(() => {
        const callNum = selectCall++
        if (callNum === 0) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }]) }) }
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SEASON_ID, seasonNumber: 1 }]) }) }
      })

      const onConflictDoUpdate = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate })
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

      const mockDb = { select: smartSelect, insert: insertMock } as unknown as Db

      const provider = makeProvider({ getSeasonEpisodes: vi.fn().mockResolvedValue(tmdbEpisodes) })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeriesSeasons(SERIES_ID)

      expect(result.result).toBe('enriched')
      expect(result.episodes.enriched).toBe(2)
      expect(result.episodes.failed).toBe(0)
      expect(insertMock).toHaveBeenCalledTimes(2)
    })
  })
})
