import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies, movieGenres } from '../db/schema/movies.js'
import { series, seriesGenres } from '../db/schema/series.js'
import { genres } from '../db/schema/genres.js'
import type { MetadataProvider } from '../providers/metadata/types.js'

type Db = PostgresJsDatabase<typeof schema>

const DEFAULT_STALE_DAYS = 7
const ENRICH_THROTTLE_MS = 250

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type EnrichResult = 'enriched' | 'skipped' | 'no-tmdb-id' | 'provider-failed'

export interface EnrichmentCounters {
  enriched: number
  skipped: number
  failed: number
}

export interface EnrichPendingResult {
  movies: EnrichmentCounters
  series: EnrichmentCounters
}

export class MetadataEnrichmentService {
  constructor(
    private readonly db: Db,
    private readonly provider: MetadataProvider,
    private readonly staleDays: number = DEFAULT_STALE_DAYS,
  ) {}

  async enrichMovie(
    movieId: string,
    opts?: { force?: boolean; staleDays?: number },
  ): Promise<EnrichResult> {
    const staleDays = opts?.staleDays ?? this.staleDays
    const [movie] = await this.db
      .select({
        id: movies.id,
        tmdbId: movies.tmdbId,
        metadataEnrichedAt: movies.metadataEnrichedAt,
      })
      .from(movies)
      .where(eq(movies.id, movieId))

    if (!movie) return 'no-tmdb-id'
    if (movie.tmdbId === null) return 'no-tmdb-id'

    if (!opts?.force && movie.metadataEnrichedAt !== null) {
      const threshold = new Date(Date.now() - staleDays * 86_400_000)
      if (movie.metadataEnrichedAt > threshold) return 'skipped'
    }

    let metadata
    try {
      metadata = await this.provider.getMovieMetadata(movie.tmdbId)
    } catch {
      return 'provider-failed'
    }
    if (metadata === null) return 'provider-failed'

    await this.db
      .update(movies)
      .set({
        title: metadata.title,
        originalTitle: metadata.originalTitle,
        year: metadata.year,
        synopsis: metadata.synopsis,
        posterPath: metadata.posterPath,
        backdropPath: metadata.backdropPath,
        durationMinutes: metadata.runtimeMinutes,
        imdbId: metadata.imdbId,
        metadataProvider: 'tmdb',
        metadataEnrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(movies.id, movieId))

    await this.upsertGenres(metadata.genres, async (genreIds) => {
      await this.db.delete(movieGenres).where(eq(movieGenres.movieId, movieId))
      if (genreIds.length > 0) {
        await this.db
          .insert(movieGenres)
          .values(genreIds.map((genreId) => ({ movieId, genreId })))
      }
    })

    return 'enriched'
  }

  async enrichSeries(
    seriesId: string,
    opts?: { force?: boolean; staleDays?: number },
  ): Promise<EnrichResult> {
    const staleDays = opts?.staleDays ?? this.staleDays
    const [seriesRow] = await this.db
      .select({
        id: series.id,
        tmdbId: series.tmdbId,
        metadataEnrichedAt: series.metadataEnrichedAt,
      })
      .from(series)
      .where(eq(series.id, seriesId))

    if (!seriesRow) return 'no-tmdb-id'
    if (seriesRow.tmdbId === null) return 'no-tmdb-id'

    if (!opts?.force && seriesRow.metadataEnrichedAt !== null) {
      const threshold = new Date(Date.now() - staleDays * 86_400_000)
      if (seriesRow.metadataEnrichedAt > threshold) return 'skipped'
    }

    let metadata
    try {
      metadata = await this.provider.getSeriesMetadata(seriesRow.tmdbId)
    } catch {
      return 'provider-failed'
    }
    if (metadata === null) return 'provider-failed'

    await this.db
      .update(series)
      .set({
        title: metadata.title,
        originalTitle: metadata.originalTitle,
        firstAirYear: metadata.firstAirYear,
        synopsis: metadata.synopsis,
        posterPath: metadata.posterPath,
        backdropPath: metadata.backdropPath,
        imdbId: metadata.imdbId,
        metadataProvider: 'tmdb',
        metadataEnrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(series.id, seriesId))

    await this.upsertGenres(metadata.genres, async (genreIds) => {
      await this.db.delete(seriesGenres).where(eq(seriesGenres.seriesId, seriesId))
      if (genreIds.length > 0) {
        await this.db
          .insert(seriesGenres)
          .values(genreIds.map((genreId) => ({ seriesId, genreId })))
      }
    })

    return 'enriched'
  }

  async enrichPending(opts?: {
    staleDays?: number
    force?: boolean
  }): Promise<EnrichPendingResult> {
    const staleDays = opts?.staleDays ?? this.staleDays
    const threshold = new Date(Date.now() - staleDays * 86_400_000)

    const [moviesToEnrich, seriesToEnrich] = await Promise.all([
      this.db
        .select({ id: movies.id })
        .from(movies)
        .where(
          and(
            isNotNull(movies.tmdbId),
            or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)),
          ),
        ),
      this.db
        .select({ id: series.id })
        .from(series)
        .where(
          and(
            isNotNull(series.tmdbId),
            or(isNull(series.metadataEnrichedAt), lt(series.metadataEnrichedAt, threshold)),
          ),
        ),
    ])

    const counts: EnrichPendingResult = {
      movies: { enriched: 0, skipped: 0, failed: 0 },
      series: { enriched: 0, skipped: 0, failed: 0 },
    }

    let firstCall = true
    for (const movie of moviesToEnrich) {
      if (!firstCall) await delay(ENRICH_THROTTLE_MS)
      firstCall = false
      try {
        const status = await this.enrichMovie(movie.id, { staleDays, force: opts?.force })
        if (status === 'enriched') counts.movies.enriched++
        else if (status === 'skipped' || status === 'no-tmdb-id') counts.movies.skipped++
        else counts.movies.failed++
      } catch {
        counts.movies.failed++
      }
    }

    for (const s of seriesToEnrich) {
      if (!firstCall) await delay(ENRICH_THROTTLE_MS)
      firstCall = false
      try {
        const status = await this.enrichSeries(s.id, { staleDays, force: opts?.force })
        if (status === 'enriched') counts.series.enriched++
        else if (status === 'skipped' || status === 'no-tmdb-id') counts.series.skipped++
        else counts.series.failed++
      } catch {
        counts.series.failed++
      }
    }

    return counts
  }

  private async upsertGenres(
    genreNames: string[],
    linkFn: (genreIds: string[]) => Promise<void>,
  ): Promise<void> {
    if (genreNames.length === 0) {
      await linkFn([])
      return
    }

    const genreValues = genreNames.map((name) => ({ name, slug: slugify(name) }))
    const slugs = genreValues.map((g) => g.slug)

    await this.db.insert(genres).values(genreValues).onConflictDoNothing()

    const genreRows = await this.db
      .select({ id: genres.id, slug: genres.slug })
      .from(genres)
      .where(inArray(genres.slug, slugs))

    await linkFn(genreRows.map((r) => r.id))
  }
}
