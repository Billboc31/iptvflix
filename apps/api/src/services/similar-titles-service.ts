import { and, desc, eq, inArray, not, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import {
  movies,
  movieAvailabilities,
  movieGenres,
  series,
  seriesAvailabilities,
  seriesGenres,
  genres,
} from '../db/schema/index.js'
import type { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { TmdbNetworkError } from '../providers/metadata/tmdb/errors.js'
import { NotFoundError } from './not-found-error.js'
import { parseYear } from '../lib/parse-year.js'

type Db = PostgresJsDatabase<typeof schema>

export interface SimilarTitleCard {
  id: string
  tmdbId: number
  title: string
  posterPath: string | null
  year: number | null
  voteAverage: number
  isAvailable: boolean
}

interface CacheEntry {
  data: SimilarTitleCard[]
  expiresAt: number
}

interface TmdbCandidate {
  tmdbId: number
  title: string
  posterPath: string | null
  year: number | null
  voteAverage: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CANDIDATES = 40
const MAX_MATERIALIZATIONS = 5

export class SimilarTitlesService {
  private readonly movieCache = new Map<string, CacheEntry>()
  private readonly seriesCache = new Map<string, CacheEntry>()

  constructor(
    private readonly db: Db,
    private readonly tmdbClient: TmdbClient,
  ) {}

  async getSimilarMovies(movieId: string, limit = 20): Promise<SimilarTitleCard[]> {
    const [source] = await this.db
      .select({ id: movies.id, tmdbId: movies.tmdbId })
      .from(movies)
      .where(eq(movies.id, movieId))

    if (!source) throw new NotFoundError('Movie', movieId)
    if (!source.tmdbId) return []

    const cacheKey = `movie:${source.tmdbId}`
    const now = Date.now()
    const cached = this.movieCache.get(cacheKey)
    if (cached && cached.expiresAt > now) return cached.data.slice(0, limit)

    try {
      const [similar, recommendations] = await Promise.all([
        this.tmdbClient.getMovieSimilar(source.tmdbId, 1),
        this.tmdbClient.getMovieRecommendations(source.tmdbId, 1),
      ])

      const candidates = mergeCandidates(
        [...similar.results, ...recommendations.results],
        source.tmdbId,
      )

      const result = await this.resolveMovieCandidates(candidates, source.id)
      this.movieCache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS })
      return result.slice(0, limit)
    } catch (err) {
      if (isTmdbError(err)) {
        console.warn('[SimilarTitlesService] TMDB unavailable for movies, falling back to genre query', err)
        return this.fallbackMoviesByGenre(source.id, limit)
      }
      throw err
    }
  }

  async getSimilarSeries(seriesId: string, limit = 20): Promise<SimilarTitleCard[]> {
    const [source] = await this.db
      .select({ id: series.id, tmdbId: series.tmdbId })
      .from(series)
      .where(eq(series.id, seriesId))

    if (!source) throw new NotFoundError('Series', seriesId)
    if (!source.tmdbId) return []

    const cacheKey = `series:${source.tmdbId}`
    const now = Date.now()
    const cached = this.seriesCache.get(cacheKey)
    if (cached && cached.expiresAt > now) return cached.data.slice(0, limit)

    try {
      const [similar, recommendations] = await Promise.all([
        this.tmdbClient.getSeriesSimilar(source.tmdbId, 1),
        this.tmdbClient.getSeriesRecommendations(source.tmdbId, 1),
      ])

      const candidates = mergeCandidates(
        [...similar.results, ...recommendations.results],
        source.tmdbId,
      )

      const result = await this.resolveSeriesCandidates(candidates, source.id)
      this.seriesCache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS })
      return result.slice(0, limit)
    } catch (err) {
      if (isTmdbError(err)) {
        console.warn('[SimilarTitlesService] TMDB unavailable for series, falling back to genre query', err)
        return this.fallbackSeriesByGenre(source.id, limit)
      }
      throw err
    }
  }

  private async resolveMovieCandidates(
    candidates: TmdbCandidate[],
    sourceId: string,
  ): Promise<SimilarTitleCard[]> {
    if (candidates.length === 0) return []

    const candidateTmdbIds = candidates.map((c) => c.tmdbId)
    const localFields = {
      id: movies.id,
      tmdbId: movies.tmdbId,
      title: movies.title,
      posterPath: movies.posterPath,
      year: movies.year,
      voteAverage: movies.voteAverage,
    } as const

    const localRows = await this.db
      .select(localFields)
      .from(movies)
      .where(inArray(movies.tmdbId, candidateTmdbIds))

    const localTmdbIdSet = new Set(localRows.map((r) => r.tmdbId!))
    const missingTmdbIds = candidateTmdbIds.filter((id) => !localTmdbIdSet.has(id))

    const toMaterialize = missingTmdbIds.slice(0, MAX_MATERIALIZATIONS)
    for (const tmdbId of toMaterialize) {
      try {
        await this.materializeMovie(tmdbId)
      } catch (err) {
        console.warn(`[SimilarTitlesService] Failed to materialize movie tmdbId=${tmdbId}`, err)
      }
    }

    const allLocalRows =
      toMaterialize.length > 0
        ? await this.db
            .select(localFields)
            .from(movies)
            .where(inArray(movies.tmdbId, candidateTmdbIds))
        : localRows

    const localByTmdbId = new Map(allLocalRows.map((r) => [r.tmdbId!, r]))
    const resolvedIds = allLocalRows.map((r) => r.id)

    if (resolvedIds.length === 0) return []

    const availSet = await this.buildMovieAvailabilitySet(resolvedIds)

    const tmdbById = new Map(candidates.map((c) => [c.tmdbId, c]))

    return candidateTmdbIds
      .filter((tmdbId) => localByTmdbId.has(tmdbId))
      .map((tmdbId) => {
        const local = localByTmdbId.get(tmdbId)!
        const candidate = tmdbById.get(tmdbId)!
        return {
          id: local.id,
          tmdbId,
          title: local.title,
          posterPath: local.posterPath ?? candidate.posterPath,
          year: local.year ?? candidate.year,
          voteAverage: local.voteAverage ?? candidate.voteAverage,
          isAvailable: availSet.has(local.id),
        }
      })
      .filter((card) => card.id !== sourceId)
  }

  private async resolveSeriesCandidates(
    candidates: TmdbCandidate[],
    sourceId: string,
  ): Promise<SimilarTitleCard[]> {
    if (candidates.length === 0) return []

    const candidateTmdbIds = candidates.map((c) => c.tmdbId)
    const localFields = {
      id: series.id,
      tmdbId: series.tmdbId,
      title: series.title,
      posterPath: series.posterPath,
      year: series.firstAirYear,
      voteAverage: series.voteAverage,
    } as const

    const localRows = await this.db
      .select(localFields)
      .from(series)
      .where(inArray(series.tmdbId, candidateTmdbIds))

    const localTmdbIdSet = new Set(localRows.map((r) => r.tmdbId!))
    const missingTmdbIds = candidateTmdbIds.filter((id) => !localTmdbIdSet.has(id))

    const toMaterialize = missingTmdbIds.slice(0, MAX_MATERIALIZATIONS)
    for (const tmdbId of toMaterialize) {
      try {
        await this.materializeSeries(tmdbId)
      } catch (err) {
        console.warn(`[SimilarTitlesService] Failed to materialize series tmdbId=${tmdbId}`, err)
      }
    }

    const allLocalRows =
      toMaterialize.length > 0
        ? await this.db
            .select(localFields)
            .from(series)
            .where(inArray(series.tmdbId, candidateTmdbIds))
        : localRows

    const localByTmdbId = new Map(allLocalRows.map((r) => [r.tmdbId!, r]))
    const resolvedIds = allLocalRows.map((r) => r.id)

    if (resolvedIds.length === 0) return []

    const availSet = await this.buildSeriesAvailabilitySet(resolvedIds)

    const tmdbById = new Map(candidates.map((c) => [c.tmdbId, c]))

    return candidateTmdbIds
      .filter((tmdbId) => localByTmdbId.has(tmdbId))
      .map((tmdbId) => {
        const local = localByTmdbId.get(tmdbId)!
        const candidate = tmdbById.get(tmdbId)!
        return {
          id: local.id,
          tmdbId,
          title: local.title,
          posterPath: local.posterPath ?? candidate.posterPath,
          year: local.year ?? candidate.year,
          voteAverage: local.voteAverage ?? candidate.voteAverage,
          isAvailable: availSet.has(local.id),
        }
      })
      .filter((card) => card.id !== sourceId)
  }

  private async fallbackMoviesByGenre(sourceId: string, limit: number): Promise<SimilarTitleCard[]> {
    const genreRows = await this.db
      .select({ genreId: movieGenres.genreId })
      .from(movieGenres)
      .where(eq(movieGenres.movieId, sourceId))

    if (genreRows.length === 0) return []

    const genreIds = genreRows.map((r) => r.genreId)

    const relatedIdRows = await this.db
      .select({ movieId: movieGenres.movieId })
      .from(movieGenres)
      .where(and(inArray(movieGenres.genreId, genreIds), not(eq(movieGenres.movieId, sourceId))))

    const uniqueIds = [...new Set(relatedIdRows.map((r) => r.movieId))].slice(0, MAX_CANDIDATES)
    if (uniqueIds.length === 0) return []

    const movieRows = await this.db
      .select({
        id: movies.id,
        tmdbId: movies.tmdbId,
        title: movies.title,
        posterPath: movies.posterPath,
        year: movies.year,
        voteAverage: movies.voteAverage,
      })
      .from(movies)
      .where(inArray(movies.id, uniqueIds))
      .orderBy(desc(movies.popularity))
      .limit(limit)

    if (movieRows.length === 0) return []

    const ids = movieRows.map((r) => r.id)
    const availSet = await this.buildMovieAvailabilitySet(ids)

    return movieRows
      .filter((r) => r.tmdbId !== null)
      .map((r) => ({
        id: r.id,
        tmdbId: r.tmdbId!,
        title: r.title,
        posterPath: r.posterPath ?? null,
        year: r.year ?? null,
        voteAverage: r.voteAverage ?? 0,
        isAvailable: availSet.has(r.id),
      }))
  }

  private async fallbackSeriesByGenre(sourceId: string, limit: number): Promise<SimilarTitleCard[]> {
    const genreRows = await this.db
      .select({ genreId: seriesGenres.genreId })
      .from(seriesGenres)
      .where(eq(seriesGenres.seriesId, sourceId))

    if (genreRows.length === 0) return []

    const genreIds = genreRows.map((r) => r.genreId)

    const relatedIdRows = await this.db
      .select({ seriesId: seriesGenres.seriesId })
      .from(seriesGenres)
      .where(and(inArray(seriesGenres.genreId, genreIds), not(eq(seriesGenres.seriesId, sourceId))))

    const uniqueIds = [...new Set(relatedIdRows.map((r) => r.seriesId))].slice(0, MAX_CANDIDATES)
    if (uniqueIds.length === 0) return []

    const seriesRows = await this.db
      .select({
        id: series.id,
        tmdbId: series.tmdbId,
        title: series.title,
        posterPath: series.posterPath,
        year: series.firstAirYear,
        voteAverage: series.voteAverage,
      })
      .from(series)
      .where(inArray(series.id, uniqueIds))
      .orderBy(desc(series.popularity))
      .limit(limit)

    if (seriesRows.length === 0) return []

    const ids = seriesRows.map((r) => r.id)
    const availSet = await this.buildSeriesAvailabilitySet(ids)

    return seriesRows
      .filter((r) => r.tmdbId !== null)
      .map((r) => ({
        id: r.id,
        tmdbId: r.tmdbId!,
        title: r.title,
        posterPath: r.posterPath ?? null,
        year: r.year ?? null,
        voteAverage: r.voteAverage ?? 0,
        isAvailable: availSet.has(r.id),
      }))
  }

  private async buildMovieAvailabilitySet(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db
      .select({ movieId: movieAvailabilities.movieId })
      .from(movieAvailabilities)
      .where(and(inArray(movieAvailabilities.movieId, ids), eq(movieAvailabilities.status, 'AVAILABLE')))
    return new Set(rows.map((r) => r.movieId))
  }

  private async buildSeriesAvailabilitySet(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db
      .select({ seriesId: seriesAvailabilities.seriesId })
      .from(seriesAvailabilities)
      .where(and(inArray(seriesAvailabilities.seriesId, ids), eq(seriesAvailabilities.status, 'AVAILABLE')))
    return new Set(rows.map((r) => r.seriesId))
  }

  private async materializeMovie(tmdbId: number): Promise<void> {
    const [existing] = await this.db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))

    if (existing) return

    let metadata = null
    try {
      metadata = await this.tmdbClient.getMovieMetadata(tmdbId)
    } catch {
      metadata = null
    }

    const [inserted] = await this.db
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
        tmdbId,
        metadataProvider: metadata ? 'tmdb' : null,
        metadataEnrichedAt: metadata ? new Date() : null,
      })
      .returning({ id: movies.id })

    if (inserted && metadata?.genreObjects?.length) {
      await this.upsertMovieGenres(inserted.id, metadata.genreObjects)
    }
  }

  private async upsertMovieGenres(
    movieId: string,
    genreObjects: Array<{ name: string; tmdbId: number }>,
  ): Promise<void> {
    const genreValues = genreObjects.map((g) => ({
      name: g.name,
      slug: slugify(g.name),
      tmdbId: g.tmdbId,
    }))
    await this.db
      .insert(genres)
      .values(genreValues)
      .onConflictDoUpdate({ target: genres.slug, set: { tmdbId: sql`EXCLUDED.tmdb_id` } })
    const slugs = genreValues.map((g) => g.slug)
    const genreRows = await this.db
      .select({ id: genres.id })
      .from(genres)
      .where(inArray(genres.slug, slugs))
    if (genreRows.length > 0) {
      await this.db
        .insert(movieGenres)
        .values(genreRows.map((r) => ({ movieId, genreId: r.id })))
        .onConflictDoNothing()
    }
  }

  private async materializeSeries(tmdbId: number): Promise<void> {
    const [existing] = await this.db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, tmdbId))

    if (existing) return

    let metadata = null
    try {
      metadata = await this.tmdbClient.getSeriesMetadata(tmdbId)
    } catch {
      metadata = null
    }

    const [inserted] = await this.db
      .insert(series)
      .values({
        title: metadata?.title ?? `tmdb:${tmdbId}`,
        originalTitle: metadata?.originalTitle ?? null,
        firstAirYear: metadata?.firstAirYear ?? null,
        synopsis: metadata?.synopsis ?? null,
        posterPath: metadata?.posterPath ?? null,
        backdropPath: metadata?.backdropPath ?? null,
        imdbId: metadata?.imdbId ?? null,
        tmdbId,
        metadataProvider: metadata ? 'tmdb' : null,
        metadataEnrichedAt: metadata ? new Date() : null,
      })
      .returning({ id: series.id })

    if (inserted && metadata?.genreObjects?.length) {
      await this.upsertSeriesGenres(inserted.id, metadata.genreObjects)
    }
  }

  private async upsertSeriesGenres(
    seriesId: string,
    genreObjects: Array<{ name: string; tmdbId: number }>,
  ): Promise<void> {
    const genreValues = genreObjects.map((g) => ({
      name: g.name,
      slug: slugify(g.name),
      tmdbId: g.tmdbId,
    }))
    await this.db
      .insert(genres)
      .values(genreValues)
      .onConflictDoUpdate({ target: genres.slug, set: { tmdbId: sql`EXCLUDED.tmdb_id` } })
    const slugs = genreValues.map((g) => g.slug)
    const genreRows = await this.db
      .select({ id: genres.id })
      .from(genres)
      .where(inArray(genres.slug, slugs))
    if (genreRows.length > 0) {
      await this.db
        .insert(seriesGenres)
        .values(genreRows.map((r) => ({ seriesId, genreId: r.id })))
        .onConflictDoNothing()
    }
  }
}

function isTmdbError(err: unknown): boolean {
  return err instanceof TmdbNetworkError || (err instanceof Error && err.name === 'TmdbRateLimitError')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mergeCandidates(
  items: Array<{ id: number; title?: string; name?: string; poster_path: string | null; release_date?: string; first_air_date?: string; vote_average: number }>,
  sourceTmdbId: number,
): TmdbCandidate[] {
  const seen = new Set<number>([sourceTmdbId])
  const result: TmdbCandidate[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push({
      tmdbId: item.id,
      title: item.title ?? item.name ?? '',
      posterPath: item.poster_path ?? null,
      year: parseYear(item.release_date ?? item.first_air_date),
      voteAverage: item.vote_average ?? 0,
    })
    if (result.length >= MAX_CANDIDATES) break
  }
  return result
}
