import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExternalDiscoveryService } from '../external-discovery-service.js'
import type { MetadataProvider, MetadataCandidate } from '../../providers/metadata/types.js'

// ---------------------------------------------------------------------------
// Mock DB builder helpers
// ---------------------------------------------------------------------------

function makeSelectChain(resolvedValue: unknown) {
  const whereWrap = vi.fn().mockResolvedValue(resolvedValue)
  const fromWrap = vi.fn().mockReturnValue({ where: whereWrap })
  return { select: vi.fn().mockReturnValue({ from: fromWrap }), from: fromWrap, where: whereWrap }
}

function makeInsertChain(returnValue: unknown) {
  const returningWrap = vi.fn().mockResolvedValue(returnValue)
  const valuesWrap = vi.fn().mockReturnValue({ returning: returningWrap })
  return { insert: vi.fn().mockReturnValue({ values: valuesWrap }), values: valuesWrap, returning: returningWrap }
}

// ---------------------------------------------------------------------------
// Mock provider factory
// ---------------------------------------------------------------------------

function makeProvider(overrides: Partial<MetadataProvider> = {}): MetadataProvider {
  return {
    searchMovies: vi.fn().mockResolvedValue([]),
    searchSeries: vi.fn().mockResolvedValue([]),
    getMovieMetadata: vi.fn().mockResolvedValue(null),
    getSeriesMetadata: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fixture candidates
// ---------------------------------------------------------------------------

const MOVIE_CANDIDATE: MetadataCandidate = {
  externalId: '603',
  title: 'The Matrix',
  year: 1999,
  mediaType: 'MOVIE',
  posterPath: '/poster.jpg',
  synopsis: 'A hacker discovers the truth.',
  releaseStatus: 'Released',
  releaseDate: '1999-03-31',
}

const SERIES_CANDIDATE: MetadataCandidate = {
  externalId: '1396',
  title: 'Breaking Bad',
  year: 2008,
  mediaType: 'SERIES',
  posterPath: '/bb.jpg',
  synopsis: 'A chemistry teacher turns to crime.',
  releaseStatus: 'Released',
  firstAirDate: '2008-01-20',
}

const UPCOMING_CANDIDATE: MetadataCandidate = {
  externalId: '9999',
  title: 'Future Film',
  year: 2027,
  mediaType: 'MOVIE',
  posterPath: null,
  synopsis: null,
  releaseStatus: 'In Production',
  releaseDate: '2027-06-15',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExternalDiscoveryService', () => {
  let provider: MetadataProvider
  let db: any
  let service: ExternalDiscoveryService

  beforeEach(() => {
    provider = makeProvider()
    db = {}
    service = new ExternalDiscoveryService(db, provider)
    vi.clearAllMocks()
  })

  describe('discoverMovies', () => {
    it('maps provider results to ExternalMovieCandidate with full poster URL', async () => {
      vi.mocked(provider.searchMovies).mockResolvedValue([MOVIE_CANDIDATE])

      const results = await service.discoverMovies('matrix', new Set())

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        tmdbId: '603',
        title: 'The Matrix',
        year: 1999,
        synopsis: 'A hacker discovers the truth.',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        releaseStatus: 'Released',
        releaseDate: '1999-03-31',
      })
    })

    it('excludes results whose tmdbId is in excludeTmdbIds', async () => {
      vi.mocked(provider.searchMovies).mockResolvedValue([MOVIE_CANDIDATE])

      const results = await service.discoverMovies('matrix', new Set(['603']))

      expect(results).toHaveLength(0)
    })

    it('caps results at 5 even when provider returns more', async () => {
      const many: MetadataCandidate[] = Array.from({ length: 10 }, (_, i) => ({
        externalId: String(i + 1),
        title: `Movie ${i + 1}`,
        year: 2020,
        mediaType: 'MOVIE' as const,
      }))
      vi.mocked(provider.searchMovies).mockResolvedValue(many)

      const results = await service.discoverMovies('movie', new Set())

      expect(results).toHaveLength(5)
    })

    it('returns [] and does not rethrow when provider throws', async () => {
      vi.mocked(provider.searchMovies).mockRejectedValue(new Error('network error'))

      const results = await service.discoverMovies('matrix', new Set())

      expect(results).toEqual([])
    })

    it('calls provider only once for the same query within TTL (cache hit)', async () => {
      vi.mocked(provider.searchMovies).mockResolvedValue([MOVIE_CANDIDATE])

      await service.discoverMovies('matrix', new Set())
      await service.discoverMovies('matrix', new Set())

      expect(provider.searchMovies).toHaveBeenCalledTimes(1)
    })

    it('correctly maps upcoming title with non-null releaseStatus', async () => {
      vi.mocked(provider.searchMovies).mockResolvedValue([UPCOMING_CANDIDATE])

      const results = await service.discoverMovies('future', new Set())

      expect(results[0].releaseStatus).toBe('In Production')
      expect(results[0].releaseDate).toBe('2027-06-15')
      expect(results[0].posterUrl).toBeNull()
    })

    it('returns null posterUrl when candidate has no posterPath', async () => {
      const noPoster: MetadataCandidate = { ...MOVIE_CANDIDATE, posterPath: null }
      vi.mocked(provider.searchMovies).mockResolvedValue([noPoster])

      const results = await service.discoverMovies('matrix', new Set())

      expect(results[0].posterUrl).toBeNull()
    })
  })

  describe('discoverSeries', () => {
    it('maps provider results to ExternalSeriesCandidate', async () => {
      vi.mocked(provider.searchSeries).mockResolvedValue([SERIES_CANDIDATE])

      const results = await service.discoverSeries('breaking', new Set())

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        tmdbId: '1396',
        title: 'Breaking Bad',
        year: 2008,
        synopsis: 'A chemistry teacher turns to crime.',
        posterUrl: 'https://image.tmdb.org/t/p/w500/bb.jpg',
        releaseStatus: 'Released',
        firstAirDate: '2008-01-20',
      })
    })

    it('returns [] when provider throws', async () => {
      vi.mocked(provider.searchSeries).mockRejectedValue(new Error('timeout'))

      const results = await service.discoverSeries('breaking', new Set())

      expect(results).toEqual([])
    })
  })

  describe('materializeMovie', () => {
    it('returns existing id when movie with tmdbId already in DB', async () => {
      const selectChain = makeSelectChain([{ id: 'existing-uuid' }])
      db.select = selectChain.select

      const result = await service.materializeMovie('603')

      expect(result).toEqual({ id: 'existing-uuid' })
      expect(provider.getMovieMetadata).not.toHaveBeenCalled()
    })

    it('creates a new movie row with metadata from provider', async () => {
      const selectChain = makeSelectChain([])
      const insertChain = makeInsertChain([{ id: 'new-uuid' }])
      db.select = selectChain.select
      db.insert = insertChain.insert

      vi.mocked(provider.getMovieMetadata).mockResolvedValue({
        title: 'The Matrix',
        originalTitle: 'The Matrix',
        year: 1999,
        synopsis: 'A hacker discovers the truth.',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        genres: ['Action', 'Sci-Fi'],
        runtimeMinutes: 136,
        imdbId: 'tt0133093',
        popularity: 64.5,
        voteAverage: 8.2,
        releaseStatus: 'Released',
        releaseDate: '1999-03-31',
      })

      const result = await service.materializeMovie('603')

      expect(result).toEqual({ id: 'new-uuid' })
      expect(provider.getMovieMetadata).toHaveBeenCalledWith(603)
    })

    it('is idempotent: second call with same tmdbId returns same id', async () => {
      const selectChain = makeSelectChain([{ id: 'existing-uuid' }])
      db.select = selectChain.select

      const first = await service.materializeMovie('603')
      const second = await service.materializeMovie('603')

      expect(first).toEqual(second)
    })

    it('creates movie with placeholder title when provider fails', async () => {
      const selectChain = makeSelectChain([])
      const insertChain = makeInsertChain([{ id: 'new-uuid' }])
      db.select = selectChain.select
      db.insert = insertChain.insert

      vi.mocked(provider.getMovieMetadata).mockRejectedValue(new Error('provider error'))

      const result = await service.materializeMovie('999')

      expect(result).toEqual({ id: 'new-uuid' })
      const insertedValues = insertChain.values.mock.calls[0][0]
      expect(insertedValues.title).toBe('tmdb:999')
      expect(insertedValues.availabilityCount).toBeUndefined()
    })

    it('throws 409 for invalid tmdbId format', async () => {
      await expect(service.materializeMovie('not-a-number')).rejects.toMatchObject({
        statusCode: 409,
      })
      await expect(service.materializeMovie('0')).rejects.toMatchObject({
        statusCode: 409,
      })
      await expect(service.materializeMovie('-1')).rejects.toMatchObject({
        statusCode: 409,
      })
    })
  })

  describe('materializeSeries', () => {
    it('creates a new series row when not in DB', async () => {
      const selectChain = makeSelectChain([])
      const insertChain = makeInsertChain([{ id: 'series-uuid' }])
      db.select = selectChain.select
      db.insert = insertChain.insert

      vi.mocked(provider.getSeriesMetadata).mockResolvedValue({
        title: 'Breaking Bad',
        originalTitle: 'Breaking Bad',
        firstAirYear: 2008,
        synopsis: 'A chemistry teacher turns to crime.',
        posterPath: '/bb.jpg',
        backdropPath: null,
        genres: ['Drama', 'Crime'],
        imdbId: 'tt0903747',
        popularity: 93.2,
        voteAverage: 9.5,
        releaseStatus: 'Released',
        firstAirDate: '2008-01-20',
      })

      const result = await service.materializeSeries('1396')

      expect(result).toEqual({ id: 'series-uuid' })
    })

    it('returns existing id when series already in DB', async () => {
      const selectChain = makeSelectChain([{ id: 'existing-series-uuid' }])
      db.select = selectChain.select

      const result = await service.materializeSeries('1396')

      expect(result).toEqual({ id: 'existing-series-uuid' })
    })
  })
})
