import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscoveryCandidatePoolService } from '../discovery-candidate-pool-service.js'
import type { MetadataProvider, MetadataCandidate } from '../../providers/metadata/types.js'
import { TmdbRateLimitError } from '../../providers/metadata/tmdb/errors.js'
import type { ExternalDiscoveryService } from '../external-discovery-service.js'

// ---------------------------------------------------------------------------
// Mock DB builder helpers
// ---------------------------------------------------------------------------

function makeSelectChain(resolvedValue: unknown) {
  const whereWrap = vi.fn().mockResolvedValue(resolvedValue)
  const fromWrap = vi.fn().mockReturnValue({ where: whereWrap })
  return { select: vi.fn().mockReturnValue({ from: fromWrap }), from: fromWrap, where: whereWrap }
}

function makeInsertUpsertChain() {
  const onConflictDoUpdateWrap = vi.fn().mockResolvedValue(undefined)
  const valuesWrap = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateWrap })
  const insertWrap = vi.fn().mockReturnValue({ values: valuesWrap })
  return {
    insert: insertWrap,
    values: valuesWrap,
    onConflictDoUpdate: onConflictDoUpdateWrap,
  }
}

function makeDeleteChain(returnValue: unknown) {
  const returningWrap = vi.fn().mockResolvedValue(returnValue)
  const whereWrap = vi.fn().mockReturnValue({ returning: returningWrap })
  const deleteWrap = vi.fn().mockReturnValue({ where: whereWrap })
  return { delete: deleteWrap, where: whereWrap, returning: returningWrap }
}

function makeUpdateChain() {
  const whereWrap = vi.fn().mockResolvedValue(undefined)
  const setWrap = vi.fn().mockReturnValue({ where: whereWrap })
  const updateWrap = vi.fn().mockReturnValue({ set: setWrap })
  return { update: updateWrap, set: setWrap, where: whereWrap }
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
    ...overrides,
  }
}

function makeExternalDiscovery(
  overrides: Partial<Pick<ExternalDiscoveryService, 'materializeMovie' | 'materializeSeries'>> = {},
): Pick<ExternalDiscoveryService, 'materializeMovie' | 'materializeSeries'> {
  return {
    materializeMovie: vi.fn().mockResolvedValue({ id: 'movie-uuid' }),
    materializeSeries: vi.fn().mockResolvedValue({ id: 'series-uuid' }),
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
  popularity: 64.5,
  voteAverage: 8.2,
}

const SERIES_CANDIDATE: MetadataCandidate = {
  externalId: '1396',
  title: 'Breaking Bad',
  year: 2008,
  mediaType: 'SERIES',
  posterPath: '/bb.jpg',
  synopsis: 'A chemistry teacher turns to crime.',
  releaseStatus: 'Ended',
  firstAirDate: '2008-01-20',
  popularity: 93.2,
  voteAverage: 9.5,
}

const CANDIDATE_ROW_MOVIE = {
  id: 'cand-uuid-1',
  externalId: '603',
  mediaType: 'MOVIE' as const,
  title: 'The Matrix',
  year: 1999,
  synopsis: null,
  posterPath: null,
  popularity: null,
  voteAverage: null,
  releaseStatus: null,
  provenance: 'popular',
  canonicalMovieId: null,
  canonicalSeriesId: null,
  refreshedAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 86400_000),
  createdAt: new Date(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DiscoveryCandidatePoolService', () => {
  let provider: MetadataProvider
  let externalDiscovery: Pick<ExternalDiscoveryService, 'materializeMovie' | 'materializeSeries'>
  let db: any
  let service: DiscoveryCandidatePoolService

  beforeEach(() => {
    provider = makeProvider()
    externalDiscovery = makeExternalDiscovery()
    db = {}
    service = new DiscoveryCandidatePoolService(
      db,
      provider,
      externalDiscovery as ExternalDiscoveryService,
    )
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. refreshPool — happy path
  // -------------------------------------------------------------------------
  describe('refreshPool', () => {
    it('upserts candidates with correct provenance and expiresAt', async () => {
      vi.mocked(provider.fetchMovieFeed).mockResolvedValueOnce([MOVIE_CANDIDATE]).mockResolvedValue([])
      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE'])

      expect(insertChain.insert).toHaveBeenCalledTimes(1)
      const rows: any[] = insertChain.values.mock.calls[0][0]
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        externalId: '603',
        mediaType: 'MOVIE',
        title: 'The Matrix',
        provenance: 'popular',
        popularity: 64.5,
        voteAverage: 8.2,
      })
      expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(1)
    })

    // -----------------------------------------------------------------------
    // 2. idempotency — second refresh produces same upsert (no duplicates by design)
    // -----------------------------------------------------------------------
    it('is idempotent: second refresh triggers onConflictDoUpdate each time', async () => {
      vi.mocked(provider.fetchMovieFeed).mockResolvedValueOnce([MOVIE_CANDIDATE]).mockResolvedValue([])
      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE'])
      // Reset mock state for the second call (simulate fresh candidates)
      vi.mocked(provider.fetchMovieFeed).mockResolvedValueOnce([MOVIE_CANDIDATE]).mockResolvedValue([])
      await service.refreshPool(['popular'], ['MOVIE'])

      // Both refreshes used upsert semantics (onConflictDoUpdate called both times)
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(2)
    })

    // -----------------------------------------------------------------------
    // 3. cross-reference — execute called to link canonical Movie/Series
    // -----------------------------------------------------------------------
    it('calls db.execute for cross-reference after upserts', async () => {
      vi.mocked(provider.fetchMovieFeed).mockResolvedValueOnce([MOVIE_CANDIDATE]).mockResolvedValue([])
      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE'])

      // Two execute calls: one for movies, one for series cross-reference
      expect(db.execute).toHaveBeenCalledTimes(2)
    })

    // -----------------------------------------------------------------------
    // 4. stops after empty page — no extra provider calls
    // -----------------------------------------------------------------------
    it('stops fetching after provider returns an empty page', async () => {
      vi.mocked(provider.fetchMovieFeed)
        .mockResolvedValueOnce([MOVIE_CANDIDATE]) // page 1
        .mockResolvedValueOnce([]) // page 2 → stop

      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE'])

      // Provider called twice (page 1 + page 2), not three times
      expect(provider.fetchMovieFeed).toHaveBeenCalledTimes(2)
      // Only page-1 results were inserted
      expect(insertChain.insert).toHaveBeenCalledTimes(1)
    })

    // -----------------------------------------------------------------------
    // 5. rate-limit on page 2 — stores page-1 results, skips remaining pages
    // -----------------------------------------------------------------------
    it('stops on TmdbRateLimitError on page 2, keeps page-1 results', async () => {
      vi.mocked(provider.fetchMovieFeed)
        .mockResolvedValueOnce([MOVIE_CANDIDATE]) // page 1 OK
        .mockRejectedValueOnce(new TmdbRateLimitError()) // page 2 rate-limited

      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE'])

      // Page-1 results inserted
      expect(insertChain.insert).toHaveBeenCalledTimes(1)
      // Page-3 never fetched (stopped at rate-limit)
      expect(provider.fetchMovieFeed).toHaveBeenCalledTimes(2)
    })

    // -----------------------------------------------------------------------
    // 6. network error — partial results for other combinations
    // -----------------------------------------------------------------------
    it('continues other feed/type combinations after a network error', async () => {
      vi.mocked(provider.fetchMovieFeed).mockRejectedValue(new Error('network failure'))
      vi.mocked(provider.fetchSeriesFeed).mockResolvedValueOnce([SERIES_CANDIDATE]).mockResolvedValue([])

      const insertChain = makeInsertUpsertChain()
      db.insert = insertChain.insert
      db.execute = vi.fn().mockResolvedValue(undefined)

      await service.refreshPool(['popular'], ['MOVIE', 'SERIES'])

      // MOVIE failed (no insert for it), SERIES succeeded
      const calls = insertChain.values.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(1)
      const allRows = calls.flatMap((c: any[]) => c[0] as any[])
      expect(allRows.some((r) => r.mediaType === 'SERIES')).toBe(true)
      expect(allRows.every((r) => r.mediaType !== 'MOVIE')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 7. evictStale — deletes expired rows, returns count
  // -------------------------------------------------------------------------
  describe('evictStale', () => {
    it('deletes rows with expiresAt in the past and returns deleted count', async () => {
      const deleteChain = makeDeleteChain([{ id: 'a' }, { id: 'b' }])
      db.delete = deleteChain.delete

      const count = await service.evictStale()

      expect(count).toBe(2)
      expect(deleteChain.delete).toHaveBeenCalledTimes(1)
    })

    it('returns 0 when no stale rows exist', async () => {
      const deleteChain = makeDeleteChain([])
      db.delete = deleteChain.delete

      const count = await service.evictStale()

      expect(count).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // 8. materializeCandidate — already linked
  // -------------------------------------------------------------------------
  describe('materializeCandidate', () => {
    it('returns existing canonical without calling ExternalDiscoveryService when already linked', async () => {
      const linkedCandidate = { ...CANDIDATE_ROW_MOVIE, canonicalMovieId: 'existing-movie-uuid' }
      const selectChain = makeSelectChain([linkedCandidate])
      db.select = selectChain.select

      const result = await service.materializeCandidate('cand-uuid-1')

      expect(result).toEqual({ movie: { id: 'existing-movie-uuid' } })
      expect(externalDiscovery.materializeMovie).not.toHaveBeenCalled()
    })

    it('returns existing series canonical when series candidate is already linked', async () => {
      const linkedSeries = {
        ...CANDIDATE_ROW_MOVIE,
        id: 'cand-uuid-2',
        mediaType: 'SERIES' as const,
        externalId: '1396',
        canonicalMovieId: null,
        canonicalSeriesId: 'existing-series-uuid',
      }
      const selectChain = makeSelectChain([linkedSeries])
      db.select = selectChain.select

      const result = await service.materializeCandidate('cand-uuid-2')

      expect(result).toEqual({ series: { id: 'existing-series-uuid' } })
      expect(externalDiscovery.materializeSeries).not.toHaveBeenCalled()
    })

    // -----------------------------------------------------------------------
    // 9. materializeCandidate — not yet linked
    // -----------------------------------------------------------------------
    it('calls ExternalDiscoveryService, updates candidate row, returns new canonical', async () => {
      const selectChain = makeSelectChain([CANDIDATE_ROW_MOVIE])
      db.select = selectChain.select
      const updateChain = makeUpdateChain()
      db.update = updateChain.update

      vi.mocked(externalDiscovery.materializeMovie).mockResolvedValue({ id: 'new-movie-uuid' })

      const result = await service.materializeCandidate('cand-uuid-1')

      expect(externalDiscovery.materializeMovie).toHaveBeenCalledWith('603')
      expect(updateChain.update).toHaveBeenCalledTimes(1)
      const setArgs = updateChain.set.mock.calls[0][0]
      expect(setArgs).toMatchObject({ canonicalMovieId: 'new-movie-uuid' })
      expect(result).toEqual({ movie: { id: 'new-movie-uuid' } })
    })

    it('calls materializeSeries for SERIES candidates not yet linked', async () => {
      const seriesCandidate = {
        ...CANDIDATE_ROW_MOVIE,
        id: 'cand-uuid-3',
        mediaType: 'SERIES' as const,
        externalId: '1396',
        canonicalMovieId: null,
        canonicalSeriesId: null,
      }
      const selectChain = makeSelectChain([seriesCandidate])
      db.select = selectChain.select
      const updateChain = makeUpdateChain()
      db.update = updateChain.update

      vi.mocked(externalDiscovery.materializeSeries).mockResolvedValue({ id: 'new-series-uuid' })

      const result = await service.materializeCandidate('cand-uuid-3')

      expect(externalDiscovery.materializeSeries).toHaveBeenCalledWith('1396')
      expect(result).toEqual({ series: { id: 'new-series-uuid' } })
    })

    // -----------------------------------------------------------------------
    // 10. materializeCandidate — unknown candidateId throws
    // -----------------------------------------------------------------------
    it('throws when candidateId is not found', async () => {
      const selectChain = makeSelectChain([])
      db.select = selectChain.select

      await expect(service.materializeCandidate('unknown-id')).rejects.toThrow(
        'Discovery candidate not found: unknown-id',
      )
    })
  })
})
