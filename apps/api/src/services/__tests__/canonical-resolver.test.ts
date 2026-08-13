import 'dotenv/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CanonicalResolver } from '../canonical-resolver.js'
import type { MetadataEnrichmentService } from '../metadata-enrichment-service.js'

function makeEnrichmentService(
  importMovieResult: { id: string } | null = { id: 'tmdb-movie-1' },
  importSeriesResult: { id: string } | null = { id: 'tmdb-series-1' },
): Pick<MetadataEnrichmentService, 'importMovieByTmdbId' | 'importSeriesByTmdbId'> {
  return {
    importMovieByTmdbId: vi.fn().mockResolvedValue(importMovieResult),
    importSeriesByTmdbId: vi.fn().mockResolvedValue(importSeriesResult),
  }
}

describe('CanonicalResolver', () => {
  describe('resolveMovieCanonical', () => {
    describe('TMDB ID path', () => {
      it('returns from tmdbCache when present without calling enrichment', async () => {
        const svc = makeEnrichmentService()
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)
        const tmdbCache = new Map([[603, 'cached-movie-uuid']])

        const result = await resolver.resolveMovieCanonical({ tmdbId: 603, tmdbCache })

        expect(result).toEqual({ id: 'cached-movie-uuid' })
        expect(svc.importMovieByTmdbId).not.toHaveBeenCalled()
      })

      it('calls importMovieByTmdbId and returns the result on cache miss', async () => {
        const svc = makeEnrichmentService({ id: 'imported-movie-uuid' })
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)
        const tmdbCache = new Map<number, string>()

        const result = await resolver.resolveMovieCanonical({ tmdbId: 603, tmdbCache })

        expect(result).toEqual({ id: 'imported-movie-uuid' })
        expect(svc.importMovieByTmdbId).toHaveBeenCalledWith(603)
        expect(tmdbCache.get(603)).toBe('imported-movie-uuid')
      })

      it('returns null when importMovieByTmdbId returns null (TMDB fetch failed)', async () => {
        const svc = makeEnrichmentService(null)
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

        const result = await resolver.resolveMovieCanonical({ tmdbId: 603 })

        expect(result).toBeNull()
      })
    })

    describe('title-match pre-pass path', () => {
      it('returns canonical when prePassId is a non-null string (MATCHED)', async () => {
        const svc = makeEnrichmentService()
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

        const result = await resolver.resolveMovieCanonical({
          tmdbId: null,
          prePassId: 'matched-canonical-uuid',
        })

        expect(result).toEqual({ id: 'matched-canonical-uuid' })
        expect(svc.importMovieByTmdbId).not.toHaveBeenCalled()
      })

      it('returns null when prePassId is null (AMBIGUOUS or UNMATCHED)', async () => {
        const svc = makeEnrichmentService()
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

        const result = await resolver.resolveMovieCanonical({ tmdbId: null, prePassId: null })

        expect(result).toBeNull()
      })

      it('returns null when prePassId is undefined and no tmdbId (title match not attempted)', async () => {
        const svc = makeEnrichmentService()
        const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

        const result = await resolver.resolveMovieCanonical({ tmdbId: null })

        expect(result).toBeNull()
      })
    })
  })

  describe('resolveSeriesCanonical', () => {
    it('returns from tmdbCache when present', async () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)
      const tmdbCache = new Map([[1396, 'cached-series-uuid']])

      const result = await resolver.resolveSeriesCanonical({ tmdbId: 1396, tmdbCache })

      expect(result).toEqual({ id: 'cached-series-uuid' })
      expect(svc.importSeriesByTmdbId).not.toHaveBeenCalled()
    })

    it('calls importSeriesByTmdbId on cache miss and populates cache', async () => {
      const svc = makeEnrichmentService(null, { id: 'imported-series-uuid' })
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)
      const tmdbCache = new Map<number, string>()

      const result = await resolver.resolveSeriesCanonical({ tmdbId: 1396, tmdbCache })

      expect(result).toEqual({ id: 'imported-series-uuid' })
      expect(svc.importSeriesByTmdbId).toHaveBeenCalledWith(1396)
      expect(tmdbCache.get(1396)).toBe('imported-series-uuid')
    })

    it('returns null when importSeriesByTmdbId returns null', async () => {
      const svc = makeEnrichmentService(null, null)
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

      const result = await resolver.resolveSeriesCanonical({ tmdbId: 1396 })

      expect(result).toBeNull()
    })

    it('returns canonical when prePassId is MATCHED', async () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

      const result = await resolver.resolveSeriesCanonical({
        tmdbId: null,
        prePassId: 'matched-series-uuid',
      })

      expect(result).toEqual({ id: 'matched-series-uuid' })
    })

    it('returns null when prePassId is null (AMBIGUOUS)', async () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

      const result = await resolver.resolveSeriesCanonical({ tmdbId: null, prePassId: null })

      expect(result).toBeNull()
    })
  })

  describe('resolveEpisodeCanonical', () => {
    // Episode resolution uses the real DB — covered by catalog-sync-service integration tests.
    // This unit test verifies the method exists and has the expected interface.
    it('has resolveEpisodeCanonical method', () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)
      expect(typeof resolver.resolveEpisodeCanonical).toBe('function')
    })
  })
})
