import { describe, it, expect, vi } from 'vitest'
import { SimilarTitlesService } from '../similar-titles-service.js'
import type { TmdbClient } from '../../providers/metadata/tmdb/client.js'
import type { TmdbSimilarResponse } from '../../providers/metadata/tmdb/client.js'
import { TmdbNetworkError } from '../../providers/metadata/tmdb/errors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_TMDB_ID = 603
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const SERIES_TMDB_ID = 1396

const SIMILAR_ITEM_1 = {
  id: 1001,
  title: 'Similar Movie 1',
  poster_path: '/poster1.jpg',
  release_date: '2020-01-01',
  vote_average: 7.5,
}

const SIMILAR_ITEM_2 = {
  id: 1002,
  title: 'Similar Movie 2',
  poster_path: null,
  release_date: '2019-06-15',
  vote_average: 6.8,
}

const SIMILAR_SERIES_ITEM_1 = {
  id: 2001,
  name: 'Similar Series 1',
  poster_path: '/series1.jpg',
  first_air_date: '2021-03-10',
  vote_average: 8.1,
}

const EMPTY_RESPONSE: TmdbSimilarResponse = { results: [] }

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeSelectChain(rows: unknown[]) {
  const resolved = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ where: resolved, ...{ mockResolve: resolved } })
  // Support .where() returning a thenable directly
  const whereResolvable = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  })
  const fromWrap = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) })
  return { select: vi.fn().mockReturnValue({ from: fromWrap }), _from: fromWrap }
}

function buildDb(selectQueues: unknown[][] = []) {
  let callCount = 0
  const db: any = {
    select: vi.fn().mockImplementation(() => {
      const rows = selectQueues[callCount++] ?? []
      const whereInner = vi.fn().mockResolvedValue(rows)
      const fromInner = vi.fn().mockReturnValue({ where: whereInner })
      return { from: fromInner }
    }),
    insert: vi.fn(),
  }
  return db
}

function buildTmdbClient(overrides: Partial<{
  getMovieSimilar: () => Promise<TmdbSimilarResponse>
  getMovieRecommendations: () => Promise<TmdbSimilarResponse>
  getSeriesSimilar: () => Promise<TmdbSimilarResponse>
  getSeriesRecommendations: () => Promise<TmdbSimilarResponse>
  getMovieMetadata: () => Promise<null>
  getSeriesMetadata: () => Promise<null>
}> = {}): TmdbClient {
  return {
    getMovieSimilar: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
    getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
    getSeriesSimilar: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
    getSeriesRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
    getMovieMetadata: vi.fn().mockResolvedValue(null),
    getSeriesMetadata: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as TmdbClient
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimilarTitlesService', () => {
  describe('getSimilarMovies — TMDB hit', () => {
    it('merges similar and recommendations, deduplicates, excludes source', async () => {
      const duplicateItem = { ...SIMILAR_ITEM_1 }
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_1, duplicateItem] }),
        getMovieRecommendations: vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_2] }),
      })

      const db: any = {
        select: vi.fn()
          // call 1: load source movie
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          // call 2: query local by tmdb_ids (initial)
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
            { id: 'c1', tmdbId: 1001 },
            { id: 'c2', tmdbId: 1002 },
          ]) }) })
          // call 3: availability
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ movieId: 'c1' }]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 20)

      expect(result).toHaveLength(2)
      expect(result[0].tmdbId).toBe(1001)
      expect(result[1].tmdbId).toBe(1002)
      // Deduplication: item 1001 appeared twice, only once in result
      const tmdbIds = result.map((r) => r.tmdbId)
      expect(new Set(tmdbIds).size).toBe(tmdbIds.length)
    })

    it('excludes the source movie from results', async () => {
      const sourceItem = { id: MOVIE_TMDB_ID, title: 'Source Movie', poster_path: null, release_date: '2020-01-01', vote_average: 7.0 }
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: [sourceItem, SIMILAR_ITEM_1] }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
      })

      const db: any = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
            { id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID },
            { id: 'c1', tmdbId: 1001 },
          ]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 20)

      expect(result.every((r) => r.id !== MOVIE_ID)).toBe(true)
    })
  })

  describe('getSimilarSeries — TMDB hit', () => {
    it('merges similar and recommendations for series', async () => {
      const tmdb = buildTmdbClient({
        getSeriesSimilar: vi.fn().mockResolvedValue({ results: [SIMILAR_SERIES_ITEM_1] }),
        getSeriesRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
      })

      const db: any = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: SERIES_ID, tmdbId: SERIES_TMDB_ID }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 's1', tmdbId: 2001, title: 'Similar Series 1', posterPath: '/series1.jpg', year: 2021, voteAverage: 8.1 }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ seriesId: 's1' }]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarSeries(SERIES_ID, 20)

      expect(result).toHaveLength(1)
      expect(result[0].tmdbId).toBe(2001)
      expect(result[0].title).toBe('Similar Series 1')
    })
  })

  describe('zero-source titles', () => {
    it('returns items with isAvailable: false when no availability row exists', async () => {
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_1] }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
      })

      const db: any = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'c1', tmdbId: 1001 }]) }) })
          // No availability rows
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 20)

      expect(result).toHaveLength(1)
      expect(result[0].isAvailable).toBe(false)
    })

    it('returns isAvailable: true when availability row exists', async () => {
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_1] }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
      })

      const db: any = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'c1', tmdbId: 1001 }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ movieId: 'c1' }]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 20)

      expect(result[0].isAvailable).toBe(true)
    })
  })

  describe('materialization cap', () => {
    it('calls materializeMovie at most MAX_MATERIALIZATIONS times', async () => {
      const missingItems = Array.from({ length: 10 }, (_, i) => ({
        id: 2000 + i,
        title: `Movie ${i}`,
        poster_path: null,
        release_date: '2020-01-01',
        vote_average: 5,
      }))

      const getMovieMetadata = vi.fn().mockResolvedValue(null)
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: missingItems }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
        getMovieMetadata,
      })

      const insertReturning = vi.fn().mockResolvedValue([])
      const insertValues = vi.fn().mockReturnValue({ returning: insertReturning })
      const db: any = {
        select: vi.fn()
          // source movie
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          // initial local query — all missing
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
          // 5 materialize calls each do select first
          .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      await service.getSimilarMovies(MOVIE_ID, 20)

      // Only 5 insertions should happen (MAX_MATERIALIZATIONS)
      expect(db.insert).toHaveBeenCalledTimes(5)
    })

    it('skips a failed materialization and continues with the rest', async () => {
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_1, SIMILAR_ITEM_2] }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
        getMovieMetadata: vi.fn().mockResolvedValue(null),
      })

      let insertCallCount = 0
      const db: any = {
        select: vi.fn()
          // source
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          // initial local — both missing
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
          // materialize selects: both missing
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
          // re-query after materialize
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'c2', tmdbId: 1002 }]) }) })
          // availability
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
        insert: vi.fn().mockImplementation(() => {
          insertCallCount++
          if (insertCallCount === 1) {
            return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error('insert failed')) }) }
          }
          return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'c2' }]) }) }
        }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      // Should not throw — failed materialization is swallowed
      const result = await service.getSimilarMovies(MOVIE_ID, 20)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('TMDB network failure', () => {
    it('returns local genre-based results without throwing on TmdbNetworkError', async () => {
      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockRejectedValue(new TmdbNetworkError('Network error')),
        getMovieRecommendations: vi.fn().mockRejectedValue(new TmdbNetworkError('Network error')),
      })

      const db: any = {
        select: vi.fn()
          // source
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          // genre rows for source
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ genreId: 'g1' }]) }) })
          // related movie ids by genre
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ movieId: 'fb1' }]) }) })
          // fetch movie details
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { id: 'fb1', tmdbId: 999, title: 'Fallback Movie', posterPath: '/fb.jpg', year: 2018, voteAverage: 7.0 },
                  ]),
                }),
              }),
            }),
          })
          // availability
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 20)

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].title).toBe('Fallback Movie')
    })
  })

  describe('cache hit', () => {
    it('does not call TMDB client again within TTL', async () => {
      const getMovieSimilar = vi.fn().mockResolvedValue({ results: [SIMILAR_ITEM_1] })
      const getMovieRecommendations = vi.fn().mockResolvedValue(EMPTY_RESPONSE)
      const tmdb = buildTmdbClient({ getMovieSimilar, getMovieRecommendations })

      const db: any = {
        select: vi.fn()
          // First call: source
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          // First call: local query
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'c1', tmdbId: 1001 }]) }) })
          // First call: availability
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
          // Second call: source (cache miss on DB side but TMDB should not be called)
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      await service.getSimilarMovies(MOVIE_ID, 20)
      await service.getSimilarMovies(MOVIE_ID, 20)

      expect(getMovieSimilar).toHaveBeenCalledTimes(1)
      expect(getMovieRecommendations).toHaveBeenCalledTimes(1)
    })
  })

  describe('limit param', () => {
    it('returns at most `limit` items', async () => {
      const manyItems = Array.from({ length: 15 }, (_, i) => ({
        id: 3000 + i,
        title: `Movie ${i}`,
        poster_path: null,
        release_date: '2020-01-01',
        vote_average: 6.0,
      }))

      const tmdb = buildTmdbClient({
        getMovieSimilar: vi.fn().mockResolvedValue({ results: manyItems }),
        getMovieRecommendations: vi.fn().mockResolvedValue(EMPTY_RESPONSE),
      })

      const localRows = manyItems.map((item, i) => ({ id: `local-${i}`, tmdbId: item.id }))
      const db: any = {
        select: vi.fn()
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: MOVIE_ID, tmdbId: MOVIE_TMDB_ID }]) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(localRows) }) })
          .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      const result = await service.getSimilarMovies(MOVIE_ID, 5)

      expect(result.length).toBeLessThanOrEqual(5)
    })
  })

  describe('NotFoundError', () => {
    it('throws NotFoundError for unknown movieId', async () => {
      const tmdb = buildTmdbClient()
      const db: any = {
        select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      await expect(service.getSimilarMovies('unknown-id', 20)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('throws NotFoundError for unknown seriesId', async () => {
      const tmdb = buildTmdbClient()
      const db: any = {
        select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }

      const service = new SimilarTitlesService(db, tmdb)
      await expect(service.getSimilarSeries('unknown-id', 20)).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })
})
