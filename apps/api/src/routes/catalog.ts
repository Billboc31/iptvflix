import type { FastifyInstance } from 'fastify'
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies, movieGenres } from '../db/schema/movies.js'
import { series as seriesTable, seriesGenres } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { episodes } from '../db/schema/episodes.js'
import { genres } from '../db/schema/genres.js'
import {
  movieAvailabilities,
  seriesAvailabilities,
  episodeAvailabilities,
} from '../db/schema/availabilities.js'
import { mediaVideos } from '../db/schema/media-videos.js'
import { mediaCredits } from '../db/schema/media-credits.js'
import { viewingProgress } from '../db/schema/viewing-progress.js'
import type {
  MovieDetailResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  EnrichmentStatus,
  AvailabilityVariantResponse,
  CastMemberResponse,
} from '@iptvflix/api-contracts'
import { getDefaultProfilePreferences } from '../services/profile-service.js'
import { resolveVariant } from '../services/availability-resolver.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import type { MetadataEnrichmentService } from '../services/metadata-enrichment-service.js'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185'

function deriveEnrichmentStatus(row: {
  tmdbId: number | null
  imdbId: string | null
  synopsis: string | null
}): EnrichmentStatus {
  const hasExternalId = row.tmdbId !== null || row.imdbId !== null
  const hasSynopsis = row.synopsis !== null
  if (hasExternalId && hasSynopsis) return 'matched'
  if (!hasExternalId && !hasSynopsis) return 'unmatched'
  return 'partial'
}

function filterString(names: (string | null)[]): string[] {
  return names.filter((n): n is string => n !== null)
}

const QUALITY_ORDER: Record<string, number> = { '4K': 3, '1080p': 2, '720p': 1, '480p': 0 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bestQuality(qualities: (string | null)[]): string | null {
  let best: string | null = null
  let bestRank = -1
  for (const q of qualities) {
    const rank = q !== null ? (QUALITY_ORDER[q] ?? -1) : -1
    if (rank > bestRank) {
      best = q
      bestRank = rank
    }
  }
  return best
}

function computeWatchState(
  profileId: string | undefined,
  progress: { progressSeconds: number; durationSeconds: number } | undefined,
): 'unwatched' | 'in_progress' | 'watched' | null {
  if (!profileId) return null
  if (!progress || progress.durationSeconds === 0) return 'unwatched'
  const ratio = progress.progressSeconds / progress.durationSeconds
  if (ratio < 0.05) return 'unwatched'
  if (ratio >= 0.90) return 'watched'
  return 'in_progress'
}

function mapCreditsToCast(
  creditRows: { role: string; name: string; character: string | null; creditOrder: number; profilePath: string | null }[],
): { cast: CastMemberResponse[]; director: string | null } {
  const cast: CastMemberResponse[] = creditRows
    .filter((c) => c.role === 'cast')
    .sort((a, b) => a.creditOrder - b.creditOrder)
    .map((c) => ({
      name: c.name,
      character: c.character,
      profileUrl: c.profilePath ? `${TMDB_IMAGE_BASE}${c.profilePath}` : null,
    }))

  const directorRow = creditRows.find((c) => c.role === 'director')
  const director = directorRow?.name ?? null

  return { cast, director }
}

interface CatalogRoutesOptions {
  enrichmentService?: MetadataEnrichmentService
}

export async function catalogRoutes(app: FastifyInstance, opts: CatalogRoutesOptions = {}): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /movies/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) return reply.status(404).send({ error: 'Movie not found' })

    const [movie] = await db.select().from(movies).where(eq(movies.id, id))
    if (!movie) return reply.status(404).send({ error: 'Movie not found' })

    const [genreRows, availCountRows, variantRows, prefs, videoRows, creditRows] = await Promise.all([
      db
        .select({ name: genres.name })
        .from(movieGenres)
        .leftJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(eq(movieGenres.movieId, id)),
      db
        .select({ cnt: count() })
        .from(movieAvailabilities)
        .where(
          and(
            eq(movieAvailabilities.movieId, id),
            eq(movieAvailabilities.status, 'AVAILABLE'),
          ),
        ),
      db
        .select({
          id: movieAvailabilities.id,
          status: movieAvailabilities.status,
          providerId: movieAvailabilities.providerId,
          audioLanguage: movieAvailabilities.audioLanguage,
          subtitleLanguage: movieAvailabilities.subtitleLanguage,
          videoQuality: movieAvailabilities.videoQuality,
          rawTitle: movieAvailabilities.rawTitle,
        })
        .from(movieAvailabilities)
        .where(eq(movieAvailabilities.movieId, id)),
      getDefaultProfilePreferences(),
      db
        .select({
          youtubeKey: mediaVideos.youtubeKey,
          videoType: mediaVideos.videoType,
          official: mediaVideos.official,
        })
        .from(mediaVideos)
        .where(and(eq(mediaVideos.mediaType, 'movie'), eq(mediaVideos.mediaId, id)))
        .orderBy(asc(mediaVideos.fetchedAt)),
      db
        .select({
          role: mediaCredits.role,
          name: mediaCredits.name,
          character: mediaCredits.character,
          creditOrder: mediaCredits.creditOrder,
          profilePath: mediaCredits.profilePath,
        })
        .from(mediaCredits)
        .where(and(eq(mediaCredits.mediaType, 'movie'), eq(mediaCredits.mediaId, id)))
        .orderBy(asc(mediaCredits.creditOrder)),
    ])

    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)
    const variants: AvailabilityVariantResponse[] = variantRows
    const { selectedVariantId } = resolveVariant(variantRows, prefs)

    const trailerKey = videoRows[0]?.youtubeKey ?? null
    const { cast, director } = mapCreditsToCast(creditRows)

    const response: MovieDetailResponse = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      synopsis: movie.synopsis,
      posterUrl: resolveMediaImageUrl(movie.posterPath),
      backdropUrl: resolveMediaImageUrl(movie.backdropPath, 'w780'),
      runtime: movie.durationMinutes,
      genres: filterString(genreRows.map((r) => r.name)),
      quality: bestQuality(variants.map((v) => v.videoQuality)),
      availabilityCount,
      availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      originalTitle: movie.originalTitle,
      imdbId: movie.imdbId,
      tmdbId: movie.tmdbId,
      enrichmentStatus: deriveEnrichmentStatus(movie),
      selectedVariantId,
      variants,
      trailerKey,
      cast,
      director,
      voteAverage: movie.voteAverage ?? null,
      certification: movie.certification ?? null,
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/series/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) return reply.status(404).send({ error: 'Series not found' })

    const [seriesRow] = await db.select().from(seriesTable).where(eq(seriesTable.id, id))
    if (!seriesRow) return reply.status(404).send({ error: 'Series not found' })

    const [
      genreRows,
      availCountRows,
      seasonRows,
      seriesVariantRows,
      prefs,
      availEpCountRows,
      videoRows,
      creditRows,
    ] = await Promise.all([
      db
        .select({ name: genres.name })
        .from(seriesGenres)
        .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
        .where(eq(seriesGenres.seriesId, id)),
      db
        .select({ cnt: count() })
        .from(seriesAvailabilities)
        .where(
          and(
            eq(seriesAvailabilities.seriesId, id),
            eq(seriesAvailabilities.status, 'AVAILABLE'),
          ),
        ),
      db
        .select({
          seasonNumber: seasons.seasonNumber,
          title: seasons.title,
          airYear: seasons.airYear,
          episodeCount: sql<number>`cast(count(${episodes.id}) as integer)`,
        })
        .from(seasons)
        .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
        .where(eq(seasons.seriesId, id))
        .groupBy(seasons.id, seasons.seasonNumber, seasons.title, seasons.airYear)
        .orderBy(asc(seasons.seasonNumber)),
      db
        .select({
          id: seriesAvailabilities.id,
          status: seriesAvailabilities.status,
          providerId: seriesAvailabilities.providerId,
          audioLanguage: seriesAvailabilities.audioLanguage,
          subtitleLanguage: seriesAvailabilities.subtitleLanguage,
          videoQuality: seriesAvailabilities.videoQuality,
          rawTitle: seriesAvailabilities.rawTitle,
        })
        .from(seriesAvailabilities)
        .where(eq(seriesAvailabilities.seriesId, id)),
      getDefaultProfilePreferences(),
      db
        .select({
          seasonNumber: seasons.seasonNumber,
          cnt: sql<number>`cast(count(distinct ${episodeAvailabilities.episodeId}) as integer)`,
        })
        .from(seasons)
        .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
        .leftJoin(
          episodeAvailabilities,
          and(
            eq(episodeAvailabilities.episodeId, episodes.id),
            eq(episodeAvailabilities.status, 'AVAILABLE'),
          ),
        )
        .where(eq(seasons.seriesId, id))
        .groupBy(seasons.id, seasons.seasonNumber),
      db
        .select({
          youtubeKey: mediaVideos.youtubeKey,
          videoType: mediaVideos.videoType,
          official: mediaVideos.official,
        })
        .from(mediaVideos)
        .where(and(eq(mediaVideos.mediaType, 'series'), eq(mediaVideos.mediaId, id)))
        .orderBy(asc(mediaVideos.fetchedAt)),
      db
        .select({
          role: mediaCredits.role,
          name: mediaCredits.name,
          character: mediaCredits.character,
          creditOrder: mediaCredits.creditOrder,
          profilePath: mediaCredits.profilePath,
        })
        .from(mediaCredits)
        .where(and(eq(mediaCredits.mediaType, 'series'), eq(mediaCredits.mediaId, id)))
        .orderBy(asc(mediaCredits.creditOrder)),
    ])

    // Fire-and-forget hierarchy hydration when canonical seasons are missing
    if (seasonRows.length === 0 && seriesRow.tmdbId != null && opts.enrichmentService) {
      console.info(`[catalog] Triggering async hierarchy hydration for series ${id}`)
      void opts.enrichmentService.enrichSeries(id)
      reply.header('X-Hierarchy-Hydrating', 'true')
    }

    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)
    const seriesVariants: AvailabilityVariantResponse[] = seriesVariantRows
    const { selectedVariantId } = resolveVariant(seriesVariantRows, prefs)

    const availEpCountMap = new Map(availEpCountRows.map((r) => [r.seasonNumber, Number(r.cnt)]))

    const trailerKey = videoRows[0]?.youtubeKey ?? null
    const { cast, director } = mapCreditsToCast(creditRows)

    const response: SeriesDetailResponse = {
      id: seriesRow.id,
      title: seriesRow.title,
      year: seriesRow.firstAirYear,
      synopsis: seriesRow.synopsis,
      posterUrl: resolveMediaImageUrl(seriesRow.posterPath),
      backdropUrl: resolveMediaImageUrl(seriesRow.backdropPath, 'w780'),
      genres: filterString(genreRows.map((r) => r.name)),
      seasonCount: seasonRows.length,
      availabilityCount,
      availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      originalTitle: seriesRow.originalTitle,
      imdbId: seriesRow.imdbId,
      tmdbId: seriesRow.tmdbId,
      enrichmentStatus: deriveEnrichmentStatus(seriesRow),
      selectedVariantId,
      seasons: seasonRows.map((s) => ({
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodeCount: Number(s.episodeCount),
        availableEpisodeCount: availEpCountMap.get(s.seasonNumber) ?? 0,
        airYear: s.airYear,
      })),
      variants: seriesVariants,
      trailerKey,
      cast,
      director,
      voteAverage: seriesRow.voteAverage ?? null,
      certification: seriesRow.certification ?? null,
      status: seriesRow.status ?? null,
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id/seasons/:seasonNumber/episodes
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { id: string; seasonNumber: string }
    Querystring: { profileId?: string }
  }>(
    '/series/:id/seasons/:seasonNumber/episodes',
    async (request, reply) => {
      const { id, seasonNumber } = request.params
      const seasonNum = parseInt(seasonNumber, 10)
      if (isNaN(seasonNum)) return reply.status(404).send({ error: 'Season not found' })

      const profileId = request.query.profileId
      if (profileId !== undefined && !UUID_RE.test(profileId)) {
        return reply.status(400).send({ error: 'Invalid profileId' })
      }

      const [season] = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.seriesId, id), eq(seasons.seasonNumber, seasonNum)))

      if (!season) return reply.status(404).send({ error: 'Season not found' })

      const [episodeRows, prefs] = await Promise.all([
        db
          .select()
          .from(episodes)
          .where(eq(episodes.seasonId, season.id))
          .orderBy(asc(episodes.episodeNumber)),
        getDefaultProfilePreferences(),
      ])

      if (episodeRows.length === 0) return []

      const episodeIds = episodeRows.map((e) => e.id)
      const [availCountRows, epVariantRaws, progressRows] = await Promise.all([
        db
          .select({ episodeId: episodeAvailabilities.episodeId, cnt: count() })
          .from(episodeAvailabilities)
          .where(
            and(
              inArray(episodeAvailabilities.episodeId, episodeIds),
              eq(episodeAvailabilities.status, 'AVAILABLE'),
            ),
          )
          .groupBy(episodeAvailabilities.episodeId),
        db
          .select({
            episodeId: episodeAvailabilities.episodeId,
            id: episodeAvailabilities.id,
            status: episodeAvailabilities.status,
            providerId: episodeAvailabilities.providerId,
            audioLanguage: episodeAvailabilities.audioLanguage,
            subtitleLanguage: episodeAvailabilities.subtitleLanguage,
            videoQuality: episodeAvailabilities.videoQuality,
            rawTitle: episodeAvailabilities.rawTitle,
          })
          .from(episodeAvailabilities)
          .where(inArray(episodeAvailabilities.episodeId, episodeIds)),
        profileId
          ? db
              .select({
                mediaId: viewingProgress.mediaId,
                progressSeconds: viewingProgress.progressSeconds,
                durationSeconds: viewingProgress.durationSeconds,
              })
              .from(viewingProgress)
              .where(
                and(
                  eq(viewingProgress.profileId, profileId),
                  eq(viewingProgress.mediaType, 'EPISODE'),
                  inArray(viewingProgress.mediaId, episodeIds),
                ),
              )
          : Promise.resolve([] as { mediaId: string; progressSeconds: number; durationSeconds: number }[]),
      ])

      const availCountMap = new Map(availCountRows.map((r) => [r.episodeId, Number(r.cnt)]))
      const progressMap = new Map(progressRows.map((r) => [r.mediaId, r]))

      const epVariantMap = new Map<string, AvailabilityVariantResponse[]>()

      for (const { episodeId, ...variant } of epVariantRaws) {
        const arr = epVariantMap.get(episodeId) ?? []
        arr.push(variant)
        epVariantMap.set(episodeId, arr)
      }

      return episodeRows.map((e): EpisodeResponse => {
        const availabilityCount = availCountMap.get(e.id) ?? 0
        const { selectedVariantId } = resolveVariant(epVariantMap.get(e.id) ?? [], prefs)
        return {
          id: e.id,
          episodeNumber: e.episodeNumber,
          title: e.title,
          synopsis: e.synopsis,
          durationMinutes: e.durationMinutes,
          airDate: e.airDate,
          availabilityCount,
          availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
          selectedVariantId,
          variants: epVariantMap.get(e.id) ?? [],
          watchState: computeWatchState(profileId, progressMap.get(e.id)),
        }
      })
    },
  )
}
