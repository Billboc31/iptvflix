import 'dotenv/config'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { CanonicalResolver } from '../canonical-resolver.js'
import type { MetadataEnrichmentService } from '../metadata-enrichment-service.js'
import { db } from '../../db/client.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { seasons } from '../../db/schema/seasons.js'
import { episodes } from '../../db/schema/episodes.js'

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
    let testSeriesId: string

    beforeEach(async () => {
      const [row] = await db
        .insert(seriesTable)
        .values({ title: 'Resolver Test Series' })
        .returning({ id: seriesTable.id })
      testSeriesId = row.id
    })

    afterEach(async () => {
      await db.delete(seriesTable).where(eq(seriesTable.id, testSeriesId))
    })

    it('creates season and episode canonical records and returns their id', async () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

      const result = await resolver.resolveEpisodeCanonical({
        seriesId: testSeriesId,
        seasonNumber: 1,
        episodeNumber: 3,
        episodeMeta: { title: 'Provider Title', synopsis: 'Provider synopsis' },
      })

      expect(result).not.toBeNull()
      expect(result!.id).toBeTypeOf('string')

      const [ep] = await db
        .select({ title: episodes.title })
        .from(episodes)
        .where(eq(episodes.id, result!.id))
      expect(ep.title).toBe('Provider Title')

      const [season] = await db
        .select({ seasonNumber: seasons.seasonNumber })
        .from(seasons)
        .where(and(eq(seasons.seriesId, testSeriesId), eq(seasons.seasonNumber, 1)))
      expect(season.seasonNumber).toBe(1)
    })

    it('returns the same id on a second call (idempotent, no overwrite)', async () => {
      const svc = makeEnrichmentService()
      const resolver = new CanonicalResolver(svc as unknown as MetadataEnrichmentService)

      const first = await resolver.resolveEpisodeCanonical({
        seriesId: testSeriesId,
        seasonNumber: 2,
        episodeNumber: 1,
        episodeMeta: { title: 'Original Title' },
      })
      expect(first).not.toBeNull()

      const second = await resolver.resolveEpisodeCanonical({
        seriesId: testSeriesId,
        seasonNumber: 2,
        episodeNumber: 1,
        episodeMeta: { title: 'Provider Dirty Title' },
      })

      expect(second!.id).toBe(first!.id)

      const [ep] = await db
        .select({ title: episodes.title })
        .from(episodes)
        .where(eq(episodes.id, first!.id))
      expect(ep.title).toBe('Original Title')
    })
  })
})
