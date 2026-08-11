import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies, series } from '../db/schema/index.js'
import type { MetadataProvider } from '../providers/metadata/types.js'
import type { ExternalMovieCandidate, ExternalSeriesCandidate } from '@iptvflix/api-contracts'

type Db = PostgresJsDatabase<typeof schema>

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const MAX_EXTERNAL_RESULTS = 5
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

export class ExternalDiscoveryService {
  private readonly movieQueryCache = new Map<string, CacheEntry<ExternalMovieCandidate[]>>()
  private readonly seriesQueryCache = new Map<string, CacheEntry<ExternalSeriesCandidate[]>>()

  constructor(
    private readonly db: Db,
    private readonly provider: MetadataProvider,
  ) {}

  async discoverMovies(
    query: string,
    excludeTmdbIds: Set<string>,
  ): Promise<ExternalMovieCandidate[]> {
    const now = Date.now()
    const cached = this.movieQueryCache.get(query)
    let all: ExternalMovieCandidate[]

    if (cached && cached.expiresAt > now) {
      all = cached.value
    } else {
      try {
        const results = await this.provider.searchMovies(query)
        all = results.map((r) => ({
          tmdbId: r.externalId,
          title: r.title,
          year: r.year,
          synopsis: r.synopsis ?? null,
          posterUrl: r.posterPath ? `${TMDB_IMAGE_BASE}${r.posterPath}` : null,
          releaseStatus: r.releaseStatus ?? null,
          releaseDate: r.releaseDate ?? null,
        }))
        this.movieQueryCache.set(query, { value: all, expiresAt: now + CACHE_TTL_MS })
      } catch {
        return []
      }
    }

    return all.filter((c) => !excludeTmdbIds.has(c.tmdbId)).slice(0, MAX_EXTERNAL_RESULTS)
  }

  async discoverSeries(
    query: string,
    excludeTmdbIds: Set<string>,
  ): Promise<ExternalSeriesCandidate[]> {
    const now = Date.now()
    const cached = this.seriesQueryCache.get(query)
    let all: ExternalSeriesCandidate[]

    if (cached && cached.expiresAt > now) {
      all = cached.value
    } else {
      try {
        const results = await this.provider.searchSeries(query)
        all = results.map((r) => ({
          tmdbId: r.externalId,
          title: r.title,
          year: r.year,
          synopsis: r.synopsis ?? null,
          posterUrl: r.posterPath ? `${TMDB_IMAGE_BASE}${r.posterPath}` : null,
          releaseStatus: r.releaseStatus ?? null,
          firstAirDate: r.firstAirDate ?? null,
        }))
        this.seriesQueryCache.set(query, { value: all, expiresAt: now + CACHE_TTL_MS })
      } catch {
        return []
      }
    }

    return all.filter((c) => !excludeTmdbIds.has(c.tmdbId)).slice(0, MAX_EXTERNAL_RESULTS)
  }

  async materializeMovie(tmdbId: string): Promise<{ id: string }> {
    const numericId = Number(tmdbId)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      const err = new Error(`Invalid tmdbId: ${tmdbId}`) as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    }

    const [existing] = await this.db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, numericId))

    if (existing) return { id: existing.id }

    let metadata = null
    try {
      metadata = await this.provider.getMovieMetadata(numericId)
    } catch {
      metadata = null
    }

    const [created] = await this.db
      .insert(movies)
      .values({
        title: metadata?.title ?? `tmdb:${tmdbId}`,
        originalTitle: metadata?.originalTitle ?? null,
        year: metadata?.year ?? null,
        synopsis: metadata?.synopsis ?? null,
        posterPath: metadata?.posterPath ?? null,
        backdropPath: metadata?.backdropPath ?? null,
        durationMinutes: metadata?.runtimeMinutes ?? null,
        imdbId: metadata?.imdbId ?? null,
        tmdbId: numericId,
        metadataProvider: metadata ? 'tmdb' : null,
        metadataEnrichedAt: metadata ? new Date() : null,
      })
      .returning({ id: movies.id })

    return { id: created.id }
  }

  async materializeSeries(tmdbId: string): Promise<{ id: string }> {
    const numericId = Number(tmdbId)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      const err = new Error(`Invalid tmdbId: ${tmdbId}`) as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    }

    const [existing] = await this.db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, numericId))

    if (existing) return { id: existing.id }

    let metadata = null
    try {
      metadata = await this.provider.getSeriesMetadata(numericId)
    } catch {
      metadata = null
    }

    const [created] = await this.db
      .insert(series)
      .values({
        title: metadata?.title ?? `tmdb:${tmdbId}`,
        originalTitle: metadata?.originalTitle ?? null,
        firstAirYear: metadata?.firstAirYear ?? null,
        synopsis: metadata?.synopsis ?? null,
        posterPath: metadata?.posterPath ?? null,
        backdropPath: metadata?.backdropPath ?? null,
        imdbId: metadata?.imdbId ?? null,
        tmdbId: numericId,
        metadataProvider: metadata ? 'tmdb' : null,
        metadataEnrichedAt: metadata ? new Date() : null,
      })
      .returning({ id: series.id })

    return { id: created.id }
  }
}
