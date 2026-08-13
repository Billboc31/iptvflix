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
  const values = vi.fn().mockReturnValue({ onConflictDoNothing })
  const returning = vi.fn().mockResolvedValue([])
  const valuesWithReturning = vi.fn().mockReturnValue({ onConflictDoNothing, returning })
  return {
    insert: vi.fn().mockReturnValue({ values: valuesWithReturning }),
    values,
    onConflictDoNothing,
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

    it('returns provider-failed when provider returns null', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const provider = makeProvider({ getMovieMetadata: vi.fn().mockResolvedValue(null) })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('provider-failed')
    })

    it('returns provider-failed when provider throws', async () => {
      const row = { id: MOVIE_ID, tmdbId: TMDB_MOVIE_ID, metadataEnrichedAt: null }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const provider = makeProvider({
        getMovieMetadata: vi.fn().mockRejectedValue(new Error('network failure')),
      })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichMovie(MOVIE_ID)
      expect(result).toBe('provider-failed')
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

    it('returns provider-failed when provider throws', async () => {
      const row = { id: SERIES_ID, tmdbId: TMDB_SERIES_ID, metadataEnrichedAt: null }
      const selectChain = makeSelectChain([row])
      const db = { ...selectChain } as unknown as Db
      const provider = makeProvider({
        getSeriesMetadata: vi.fn().mockRejectedValue(new Error('network')),
      })
      const service = new MetadataEnrichmentService(db, provider)
      const result = await service.enrichSeries(SERIES_ID)
      expect(result).toBe('provider-failed')
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

    it('upserts title, synopsis, airDate from TMDB onto existing episode rows', async () => {
      const tmdbEpisodes: ExternalSeasonEpisode[] = [
        { episodeNumber: 1, title: 'Pilot (TMDB)', synopsis: 'Synop', airDate: '2024-01-15', runtimeMinutes: 45, stillPath: null },
      ]

      let callIdx = 0
      const callResults = [
        [{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }],
        [{ id: SEASON_ID, seasonNumber: 1 }],
        [{ id: EPISODE_ID }],
      ]

      const whereMock = vi.fn().mockImplementation(() => Promise.resolve(callResults[callIdx++] ?? []))
      const limitMock = vi.fn().mockImplementation(() => Promise.resolve(callResults[callIdx++] ?? []))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: limitMock }) }),
      }))

      // Override: first call returns series, second call returns seasons, subsequent calls return episodes
      let selectCall = 0
      const smartSelect = vi.fn().mockImplementation(() => {
        const callNum = selectCall++
        if (callNum === 0) {
          // series lookup
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }]) }) }
        }
        if (callNum === 1) {
          // seasons lookup
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SEASON_ID, seasonNumber: 1 }]) }) }
        }
        // episode lookup
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: EPISODE_ID }]) }) }) }
      })

      const whereUpdate = vi.fn().mockResolvedValue(undefined)
      const setMock = vi.fn().mockReturnValue({ where: whereUpdate })
      const updateMock = vi.fn().mockReturnValue({ set: setMock })

      const mockDb = {
        select: smartSelect,
        update: updateMock,
      } as unknown as Db

      const provider = makeProvider({
        getSeasonEpisodes: vi.fn().mockResolvedValue(tmdbEpisodes),
      })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeriesSeasons(SERIES_ID)

      expect(result.result).toBe('enriched')
      expect(provider.getSeasonEpisodes).toHaveBeenCalledWith(TMDB_SERIES_ID, 1)
      expect(updateMock).toHaveBeenCalled()
      const setArgs = setMock.mock.calls[0][0] as Record<string, unknown>
      expect(setArgs.title).toBe('Pilot (TMDB)')
      expect(setArgs.synopsis).toBe('Synop')
      expect(setArgs.airDate).toBe('2024-01-15')
    })

    it('does not INSERT a new episode row for a TMDB episode with no matching DB row', async () => {
      let selectCall = 0
      const smartSelect = vi.fn().mockImplementation(() => {
        const callNum = selectCall++
        if (callNum === 0) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: TMDB_SERIES_ID }]) }) }
        }
        if (callNum === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SEASON_ID, seasonNumber: 1 }]) }) }
        }
        // Episode lookup returns empty — TMDB-only episode, no DB row
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }
      })

      const insertMock = vi.fn()
      const updateMock = vi.fn()

      const mockDb = {
        select: smartSelect,
        insert: insertMock,
        update: updateMock,
      } as unknown as Db

      const provider = makeProvider({
        getSeasonEpisodes: vi.fn().mockResolvedValue([
          { episodeNumber: 99, title: 'TMDB Only', synopsis: null, airDate: null, runtimeMinutes: null, stillPath: null },
        ]),
      })

      const service = new MetadataEnrichmentService(mockDb, provider)
      const result = await service.enrichSeriesSeasons(SERIES_ID)

      expect(result.result).toBe('enriched')
      expect(result.episodes.skipped).toBe(1)
      expect(insertMock).not.toHaveBeenCalled()
      expect(updateMock).not.toHaveBeenCalled()
    })
  })
})
