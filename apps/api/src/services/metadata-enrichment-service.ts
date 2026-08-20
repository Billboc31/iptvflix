import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies, movieGenres } from '../db/schema/movies.js'
import { series, seriesGenres } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { episodes } from '../db/schema/episodes.js'
import { genres } from '../db/schema/genres.js'
import { collections } from '../db/schema/collections.js'
import { mediaVideos } from '../db/schema/media-videos.js'
import { mediaCredits } from '../db/schema/media-credits.js'
import { persons } from '../db/schema/persons.js'
import { enrichmentFailures } from '../db/schema/enrichment-failures.js'
import type { MetadataProvider, ExternalVideo, ExternalCreditPerson, ExternalSeasonEpisode, ExternalMovieMetadata, ExternalSeriesMetadata } from '../providers/metadata/types.js'
import { MetadataMappingError } from '../providers/metadata/types.js'

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

function pickBestTrailer(videos: ExternalVideo[]): ExternalVideo | null {
  const officialTrailer = videos.find((v) => v.official && v.type === 'Trailer')
  if (officialTrailer) return officialTrailer
  const anyTrailer = videos.find((v) => v.type === 'Trailer')
  if (anyTrailer) return anyTrailer
  const teaser = videos.find((v) => v.official && v.type === 'Teaser') ?? videos.find((v) => v.type === 'Teaser')
  return teaser ?? null
}

interface FailureInfo {
  errorClass: string | null
  errorCode: string | null
  errorMessage: string
  retryable: boolean
}

function classifyError(err: unknown): FailureInfo {
  if (err instanceof Error) {
    const anyErr = err as unknown as Record<string, unknown>
    const code = typeof anyErr['code'] === 'string' ? anyErr['code'] : null
    const name = err.constructor?.name ?? err.name ?? 'Error'
    const isTransient =
      name.includes('Network') ||
      name.includes('RateLimit') ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED'
    return {
      errorClass: name,
      errorCode: code,
      errorMessage: err.message,
      retryable: isTransient,
    }
  }
  return {
    errorClass: null,
    errorCode: null,
    errorMessage: String(err),
    retryable: false,
  }
}

export type EnrichResult = 'enriched' | 'skipped' | 'no-tmdb-id' | 'provider-failed' | 'terminal-failed'

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
    private readonly onEnriched?: (mediaId: string, mediaType: 'MOVIE' | 'SERIES') => void,
  ) {}

  async persistFailure(opts: {
    mediaType: 'MOVIE' | 'SERIES'
    mediaId: string
    tmdbId?: number | null
    title?: string | null
    stage: 'fetch' | 'map' | 'db_update' | 'seasons'
    err: unknown
    runId?: string | null
  }): Promise<{ retryable: boolean }> {
    const { errorClass, errorCode, errorMessage, retryable } = classifyError(opts.err)
    await this.db
      .insert(enrichmentFailures)
      .values({
        mediaType: opts.mediaType,
        mediaId: opts.mediaId,
        tmdbId: opts.tmdbId ?? null,
        title: opts.title ?? null,
        stage: opts.stage,
        errorClass,
        errorCode,
        errorMessage,
        retryable,
        runId: opts.runId ?? null,
      })
      .onConflictDoUpdate({
        target: [enrichmentFailures.mediaType, enrichmentFailures.mediaId],
        set: {
          tmdbId: sql`EXCLUDED.tmdb_id`,
          title: sql`EXCLUDED.title`,
          stage: sql`EXCLUDED.stage`,
          errorClass: sql`EXCLUDED.error_class`,
          errorCode: sql`EXCLUDED.error_code`,
          errorMessage: sql`EXCLUDED.error_message`,
          retryable: sql`EXCLUDED.retryable`,
          retryCount: sql`${enrichmentFailures.retryCount} + 1`,
          occurredAt: sql`now()`,
          runId: sql`EXCLUDED.run_id`,
        },
      })
    return { retryable }
  }

  private async clearFailure(mediaType: 'MOVIE' | 'SERIES', mediaId: string): Promise<void> {
    await this.db
      .delete(enrichmentFailures)
      .where(
        and(
          eq(enrichmentFailures.mediaType, mediaType),
          eq(enrichmentFailures.mediaId, mediaId),
        ),
      )
  }

  async enrichMovie(
    movieId: string,
    opts?: { force?: boolean; staleDays?: number; runId?: string },
  ): Promise<EnrichResult> {
    const staleDays = opts?.staleDays ?? this.staleDays
    const [movie] = await this.db
      .select({
        id: movies.id,
        tmdbId: movies.tmdbId,
        title: movies.title,
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

    let metadata, videos: ExternalVideo[], credits: ExternalCreditPerson[], certification: string | null
    try {
      ;[metadata, videos, credits, certification] = await Promise.all([
        this.provider.getMovieMetadata(movie.tmdbId),
        this.provider.getMovieVideos(movie.tmdbId),
        this.provider.getMovieCredits(movie.tmdbId),
        this.provider.getMovieCertification(movie.tmdbId),
      ])
    } catch (err) {
      const { retryable } = await this.persistFailure({
        mediaType: 'MOVIE',
        mediaId: movieId,
        tmdbId: movie.tmdbId,
        title: movie.title,
        stage: err instanceof MetadataMappingError ? 'map' : 'fetch',
        err,
        runId: opts?.runId,
      })
      return retryable ? 'provider-failed' : 'terminal-failed'
    }
    if (metadata === null) {
      await this.persistFailure({
        mediaType: 'MOVIE',
        mediaId: movieId,
        tmdbId: movie.tmdbId,
        title: movie.title,
        stage: 'fetch',
        err: new Error('TMDB returned null (404 or empty)'),
        runId: opts?.runId,
      })
      return 'terminal-failed'
    }

    // Upsert collection if movie belongs to one
    let collectionId: string | null = null
    if (metadata.belongsToCollection) {
      const bc = metadata.belongsToCollection
      try {
        const [collRow] = await this.db
          .insert(collections)
          .values({
            tmdbId: bc.tmdbId,
            name: bc.name,
            posterPath: bc.posterPath,
            backdropPath: bc.backdropPath,
          })
          .onConflictDoUpdate({
            target: collections.tmdbId,
            set: {
              name: bc.name,
              posterPath: bc.posterPath,
              backdropPath: bc.backdropPath,
            },
          })
          .returning({ id: collections.id })
        collectionId = collRow?.id ?? null
      } catch (err) {
        console.warn(`[enrichment] collection upsert failed for movie ${movieId}:`, err)
      }
    }

    try {
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
          voteAverage: metadata.voteAverage,
          voteCount: metadata.voteCount ?? null,
          certification,
          metadataProvider: 'tmdb',
          metadataEnrichedAt: new Date(),
          updatedAt: new Date(),
          status: metadata.status ?? metadata.releaseStatus ?? null,
          popularity: metadata.popularity ?? null,
          originalLanguage: metadata.originalLanguage ?? null,
          spokenLanguages: metadata.spokenLanguages ?? null,
          productionCountries: metadata.productionCountries ?? null,
          tagline: metadata.tagline ?? null,
          keywords: metadata.keywords ?? null,
          externalIds: metadata.externalIds ?? null,
          collectionId,
          tmdbSyncedAt: new Date(),
        })
        .where(eq(movies.id, movieId))
    } catch (err) {
      const { retryable } = await this.persistFailure({
        mediaType: 'MOVIE',
        mediaId: movieId,
        tmdbId: movie.tmdbId,
        title: movie.title,
        stage: 'db_update',
        err,
        runId: opts?.runId,
      })
      return retryable ? 'provider-failed' : 'terminal-failed'
    }

    await this.upsertGenres(metadata.genres, metadata.genreObjects, async (genreIds) => {
      await this.db.delete(movieGenres).where(eq(movieGenres.movieId, movieId))
      if (genreIds.length > 0) {
        await this.db
          .insert(movieGenres)
          .values(genreIds.map((genreId) => ({ movieId, genreId })))
      }
    })

    await this.persistVideos('movie', movieId, videos)
    await this.persistCredits('movie', movieId, credits)
    await this.persistFrenchLocalization('movie', movieId, movie.tmdbId, metadata.title, metadata.synopsis ?? null, metadata.tagline ?? null)

    await this.clearFailure('MOVIE', movieId)
    this.onEnriched?.(movieId, 'MOVIE')
    return 'enriched'
  }

  async enrichSeries(
    seriesId: string,
    opts?: { force?: boolean; staleDays?: number; runId?: string },
  ): Promise<EnrichResult> {
    const staleDays = opts?.staleDays ?? this.staleDays
    const [seriesRow] = await this.db
      .select({
        id: series.id,
        tmdbId: series.tmdbId,
        title: series.title,
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

    let metadata, videos: ExternalVideo[], credits: ExternalCreditPerson[], certification: string | null
    try {
      ;[metadata, videos, credits, certification] = await Promise.all([
        this.provider.getSeriesMetadata(seriesRow.tmdbId),
        this.provider.getSeriesVideos(seriesRow.tmdbId),
        this.provider.getSeriesCredits(seriesRow.tmdbId),
        this.provider.getSeriesCertification(seriesRow.tmdbId),
      ])
    } catch (err) {
      const { retryable } = await this.persistFailure({
        mediaType: 'SERIES',
        mediaId: seriesId,
        tmdbId: seriesRow.tmdbId,
        title: seriesRow.title,
        stage: err instanceof MetadataMappingError ? 'map' : 'fetch',
        err,
        runId: opts?.runId,
      })
      return retryable ? 'provider-failed' : 'terminal-failed'
    }
    if (metadata === null) {
      await this.persistFailure({
        mediaType: 'SERIES',
        mediaId: seriesId,
        tmdbId: seriesRow.tmdbId,
        title: seriesRow.title,
        stage: 'fetch',
        err: new Error('TMDB returned null (404 or empty)'),
        runId: opts?.runId,
      })
      return 'terminal-failed'
    }

    try {
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
          voteAverage: metadata.voteAverage,
          voteCount: metadata.voteCount ?? null,
          certification,
          status: metadata.status,
          metadataProvider: 'tmdb',
          metadataEnrichedAt: new Date(),
          updatedAt: new Date(),
          popularity: metadata.popularity ?? null,
          originalLanguage: metadata.originalLanguage ?? null,
          spokenLanguages: metadata.spokenLanguages ?? null,
          productionCountries: metadata.productionCountries ?? null,
          tagline: metadata.tagline ?? null,
          inProduction: metadata.inProduction ?? null,
          networks: metadata.networks ?? null,
          createdBy: metadata.createdBy ?? null,
          numberOfSeasons: metadata.numberOfSeasons ?? null,
          numberOfEpisodes: metadata.numberOfEpisodes ?? null,
          keywords: metadata.keywords ?? null,
          externalIds: metadata.externalIds ?? null,
          tmdbSyncedAt: new Date(),
        })
        .where(eq(series.id, seriesId))
    } catch (err) {
      const { retryable } = await this.persistFailure({
        mediaType: 'SERIES',
        mediaId: seriesId,
        tmdbId: seriesRow.tmdbId,
        title: seriesRow.title,
        stage: 'db_update',
        err,
        runId: opts?.runId,
      })
      return retryable ? 'provider-failed' : 'terminal-failed'
    }

    await this.upsertGenres(metadata.genres, metadata.genreObjects, async (genreIds) => {
      await this.db.delete(seriesGenres).where(eq(seriesGenres.seriesId, seriesId))
      if (genreIds.length > 0) {
        await this.db
          .insert(seriesGenres)
          .values(genreIds.map((genreId) => ({ seriesId, genreId })))
      }
    })

    await this.persistVideos('series', seriesId, videos)
    await this.persistCredits('series', seriesId, credits)
    await this.persistFrenchLocalization('series', seriesId, seriesRow.tmdbId, metadata.title, metadata.synopsis ?? null, metadata.tagline ?? null)

    // Upsert canonical season rows from TMDB — creates them if absent, updates if present
    if (metadata.seasons && metadata.seasons.length > 0) {
      for (const s of metadata.seasons) {
        await this.db
          .insert(seasons)
          .values({
            seriesId,
            seasonNumber: s.seasonNumber,
            tmdbId: s.tmdbId ?? null,
            title: s.name ?? null,
            posterPath: s.posterPath ?? null,
            episodeCount: s.episodeCount ?? null,
            airYear: s.airDate ? new Date(s.airDate).getFullYear() : null,
          })
          .onConflictDoUpdate({
            target: [seasons.seriesId, seasons.seasonNumber],
            set: {
              tmdbId: sql`EXCLUDED.tmdb_id`,
              title: sql`EXCLUDED.title`,
              posterPath: sql`EXCLUDED.poster_path`,
              episodeCount: sql`EXCLUDED.episode_count`,
              airYear: sql`EXCLUDED.air_year`,
              updatedAt: sql`now()`,
            },
          })
      }
    }

    let seasonsFailureResult: EnrichResult | null = null
    try {
      await this.enrichSeriesSeasons(seriesId)
    } catch (err) {
      console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
      const { retryable } = await this.persistFailure({
        mediaType: 'SERIES',
        mediaId: seriesId,
        tmdbId: seriesRow.tmdbId,
        title: seriesRow.title,
        stage: 'seasons',
        err,
        runId: opts?.runId,
      })
      seasonsFailureResult = retryable ? 'provider-failed' : 'terminal-failed'
    }

    if (seasonsFailureResult !== null) {
      return seasonsFailureResult
    }
    await this.clearFailure('SERIES', seriesId)
    this.onEnriched?.(seriesId, 'SERIES')
    return 'enriched'
  }

  async enrichSeriesSeasons(
    seriesId: string,
  ): Promise<{ result: 'no-tmdb-id' | 'enriched'; episodes: EnrichmentCounters }> {
    const emptyCounters: EnrichmentCounters = { enriched: 0, skipped: 0, failed: 0 }

    const [seriesRow] = await this.db
      .select({ id: series.id, tmdbId: series.tmdbId })
      .from(series)
      .where(eq(series.id, seriesId))

    if (!seriesRow || seriesRow.tmdbId === null) {
      return { result: 'no-tmdb-id', episodes: emptyCounters }
    }

    if (!this.provider.getSeasonEpisodes) {
      return { result: 'no-tmdb-id', episodes: emptyCounters }
    }

    const tmdbId = seriesRow.tmdbId
    const seasonRows = await this.db
      .select({ id: seasons.id, seasonNumber: seasons.seasonNumber })
      .from(seasons)
      .where(eq(seasons.seriesId, seriesId))

    const counters: EnrichmentCounters = { enriched: 0, skipped: 0, failed: 0 }

    let firstCall = true
    for (const season of seasonRows) {
      if (!firstCall) await delay(ENRICH_THROTTLE_MS)
      firstCall = false

      let tmdbEpisodes: ExternalSeasonEpisode[]
      try {
        tmdbEpisodes = await this.provider.getSeasonEpisodes(tmdbId, season.seasonNumber)
      } catch {
        counters.failed++
        continue
      }

      for (const tmdbEp of tmdbEpisodes) {
        try {
          await this.db
            .insert(episodes)
            .values({
              seasonId: season.id,
              seriesId,
              episodeNumber: tmdbEp.episodeNumber,
              title: tmdbEp.title ?? null,
              synopsis: tmdbEp.synopsis ?? null,
              airDate: tmdbEp.airDate ?? null,
              durationMinutes: tmdbEp.runtimeMinutes ?? null,
              tmdbId: tmdbEp.tmdbId ?? null,
              posterPath: tmdbEp.stillPath ?? null,
              voteAverage: tmdbEp.voteAverage ?? null,
              voteCount: tmdbEp.voteCount ?? null,
            })
            .onConflictDoUpdate({
              target: [episodes.seasonId, episodes.episodeNumber],
              set: {
                title: sql`EXCLUDED.title`,
                synopsis: sql`EXCLUDED.synopsis`,
                airDate: sql`EXCLUDED.air_date`,
                durationMinutes: sql`EXCLUDED.duration_minutes`,
                tmdbId: sql`EXCLUDED.tmdb_id`,
                posterPath: sql`COALESCE(EXCLUDED.poster_path, ${episodes.posterPath})`,
                voteAverage: sql`EXCLUDED.vote_average`,
                voteCount: sql`EXCLUDED.vote_count`,
                updatedAt: sql`now()`,
              },
            })
          counters.enriched++
        } catch {
          counters.failed++
        }
      }
    }

    return { result: 'enriched', episodes: counters }
  }

  /**
   * Ensures a canonical movie row exists for the given TMDB ID.
   * When the movie is not in the local DB, fetches the title from TMDB and inserts
   * a canonical skeleton (no provider metadata). Enrichment fills the rest later.
   */
  async importMovieByTmdbId(tmdbId: number): Promise<{ id: string } | null> {
    const [existing] = await this.db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
    if (existing) return existing

    let title: string
    try {
      const meta = await this.provider.getMovieMetadata(tmdbId)
      if (!meta) return null
      title = meta.title
    } catch {
      return null
    }

    const [inserted] = await this.db
      .insert(movies)
      .values({ title, tmdbId, matchStatus: 'MATCHED' })
      .onConflictDoNothing({ target: movies.tmdbId })
      .returning({ id: movies.id })

    if (inserted) return inserted

    const [row] = await this.db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
    return row ?? null
  }

  /**
   * Ensures a canonical series row exists for the given TMDB ID.
   * When the series is not in the local DB, fetches the title from TMDB and inserts
   * a canonical skeleton (no provider metadata). Enrichment fills the rest later.
   */
  async importSeriesByTmdbId(tmdbId: number): Promise<{ id: string } | null> {
    const [existing] = await this.db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, tmdbId))
    if (existing) return existing

    let title: string
    try {
      const meta = await this.provider.getSeriesMetadata(tmdbId)
      if (!meta) return null
      title = meta.title
    } catch {
      return null
    }

    const [inserted] = await this.db
      .insert(series)
      .values({ title, tmdbId, matchStatus: 'MATCHED' })
      .onConflictDoNothing({ target: series.tmdbId })
      .returning({ id: series.id })

    if (inserted) return inserted

    const [row] = await this.db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.tmdbId, tmdbId))
    return row ?? null
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
            eq(movies.matchStatus, 'MATCHED'),
            or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)),
          ),
        ),
      this.db
        .select({ id: series.id })
        .from(series)
        .where(
          and(
            isNotNull(series.tmdbId),
            eq(series.matchStatus, 'MATCHED'),
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

  private async persistVideos(
    mediaType: string,
    mediaId: string,
    videos: ExternalVideo[],
  ): Promise<void> {
    await this.db
      .delete(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, mediaType), eq(mediaVideos.mediaId, mediaId)))

    const best = pickBestTrailer(videos)
    if (!best) return

    await this.db.insert(mediaVideos).values({
      mediaType,
      mediaId,
      youtubeKey: best.key,
      videoType: best.type,
      official: best.official,
      publishedAt: best.publishedAt ? new Date(best.publishedAt) : null,
    })
  }

  private async persistCredits(
    mediaType: string,
    mediaId: string,
    credits: ExternalCreditPerson[],
  ): Promise<void> {
    await this.db
      .delete(mediaCredits)
      .where(and(eq(mediaCredits.mediaType, mediaType), eq(mediaCredits.mediaId, mediaId)))

    if (credits.length === 0) return

    // Upsert persons for any credit that carries a TMDB person ID
    const personIdByTmdbId = new Map<number, string>()
    const creditsWithPersonId = await Promise.all(
      credits.map(async (c) => {
        if (!c.tmdbPersonId) return { ...c, resolvedPersonId: null }
        const cached = personIdByTmdbId.get(c.tmdbPersonId)
        if (cached) return { ...c, resolvedPersonId: cached }
        const [row] = await this.db
          .insert(persons)
          .values({
            tmdbPersonId: c.tmdbPersonId,
            name: c.name,
            profilePath: c.profilePath ?? null,
          })
          .onConflictDoUpdate({
            target: persons.tmdbPersonId,
            set: { name: c.name, profilePath: c.profilePath ?? null },
          })
          .returning({ id: persons.id })
        if (row) personIdByTmdbId.set(c.tmdbPersonId, row.id)
        return { ...c, resolvedPersonId: row?.id ?? null }
      }),
    )

    await this.db.insert(mediaCredits).values(
      creditsWithPersonId.map((c) => ({
        mediaType,
        mediaId,
        role: c.role,
        name: c.name,
        character: c.character,
        creditOrder: c.order,
        profilePath: c.profilePath,
        tmdbPersonId: c.tmdbPersonId ?? null,
        personId: c.resolvedPersonId ?? null,
        department: c.department ?? null,
        job: c.job ?? null,
        isDirector: c.role === 'director',
        isCreator: c.role === 'creator',
      })),
    )
  }

  private async persistFrenchLocalization(
    mediaType: 'movie' | 'series',
    mediaId: string,
    tmdbId: number,
    defaultTitle: string,
    defaultSynopsis: string | null,
    defaultTagline: string | null,
  ): Promise<void> {
    let frMetadata: ExternalMovieMetadata | ExternalSeriesMetadata | null
    try {
      frMetadata =
        mediaType === 'movie'
          ? await this.provider.getMovieMetadata(tmdbId, { language: 'fr-FR' })
          : await this.provider.getSeriesMetadata(tmdbId, { language: 'fr-FR' })
    } catch (err) {
      console.warn(`[enrichment] persistFrenchLocalization(${mediaType} ${mediaId}) failed:`, err)
      return
    }
    if (!frMetadata) return

    const fr: { title?: string; synopsis?: string; tagline?: string } = {}
    if (frMetadata.title && frMetadata.title !== defaultTitle) fr.title = frMetadata.title
    const frSynopsis = frMetadata.synopsis ?? null
    if (frSynopsis && frSynopsis !== defaultSynopsis) fr.synopsis = frSynopsis
    const frTagline = frMetadata.tagline ?? null
    if (frTagline && frTagline !== defaultTagline) fr.tagline = frTagline

    if (Object.keys(fr).length === 0) return

    if (mediaType === 'movie') {
      await this.db.update(movies).set({ localizations: { fr } }).where(eq(movies.id, mediaId))
    } else {
      await this.db.update(series).set({ localizations: { fr } }).where(eq(series.id, mediaId))
    }
  }

  private async upsertGenres(
    genreNames: string[],
    genreObjects: Array<{ name: string; tmdbId: number }> | undefined,
    linkFn: (genreIds: string[]) => Promise<void>,
  ): Promise<void> {
    if (genreNames.length === 0) {
      await linkFn([])
      return
    }

    let slugs: string[]

    if (genreObjects && genreObjects.length > 0) {
      const genreValues = genreObjects.map((g) => ({ name: g.name, slug: slugify(g.name), tmdbId: g.tmdbId }))
      slugs = genreValues.map((g) => g.slug)
      await this.db
        .insert(genres)
        .values(genreValues)
        .onConflictDoUpdate({ target: genres.slug, set: { tmdbId: sql`EXCLUDED.tmdb_id` } })
    } else {
      const genreValues = genreNames.map((name) => ({ name, slug: slugify(name) }))
      slugs = genreValues.map((g) => g.slug)
      await this.db.insert(genres).values(genreValues).onConflictDoNothing()
    }

    const genreRows = await this.db
      .select({ id: genres.id, slug: genres.slug })
      .from(genres)
      .where(inArray(genres.slug, slugs))

    await linkFn(genreRows.map((r) => r.id))
  }
}
