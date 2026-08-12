import type { FastifyInstance } from 'fastify'
import { and, count, eq, inArray, asc, sql } from 'drizzle-orm'
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
import { viewingProgress } from '../db/schema/viewing-progress.js'
import type {
  MovieDetailResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  EnrichmentStatus,
  AvailabilityVariantResponse,
} from '@iptvflix/api-contracts'
import { getDefaultProfilePreferences } from '../services/profile-service.js'
import { resolveVariant } from '../services/availability-resolver.js'

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

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /movies/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) return reply.status(404).send({ error: 'Movie not found' })

    const [movie] = await db.select().from(movies).where(eq(movies.id, id))
    if (!movie) return reply.status(404).send({ error: 'Movie not found' })

    const [genreRows, availCountRows, variantRows, prefs] = await Promise.all([
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
    ])

    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)
    const variants: AvailabilityVariantResponse[] = variantRows
    const { selectedVariantId } = resolveVariant(variantRows, prefs)

    const response: MovieDetailResponse = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      synopsis: movie.synopsis,
      posterUrl: movie.posterPath,
      backdropUrl: movie.backdropPath,
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

    const [genreRows, availCountRows, seasonRows, seriesVariantRows, prefs, availEpCountRows] = await Promise.all([
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
    ])

    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)
    const seriesVariants: AvailabilityVariantResponse[] = seriesVariantRows
    const { selectedVariantId } = resolveVariant(seriesVariantRows, prefs)

    const availEpCountMap = new Map(availEpCountRows.map((r) => [r.seasonNumber, Number(r.cnt)]))

    const response: SeriesDetailResponse = {
      id: seriesRow.id,
      title: seriesRow.title,
      year: seriesRow.firstAirYear,
      synopsis: seriesRow.synopsis,
      posterUrl: seriesRow.posterPath,
      backdropUrl: seriesRow.backdropPath,
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
      const epRawVariantMap = new Map<
        string,
        Array<{
          id: string
          status: 'AVAILABLE' | 'UNAVAILABLE'
          providerId: string
          audioLanguage: string | null
          subtitleLanguage: string | null
          videoQuality: string | null
          rawTitle: string | null
        }>
      >()

      for (const { episodeId, ...variant } of epVariantRaws) {
        const arr = epVariantMap.get(episodeId) ?? []
        arr.push(variant)
        epVariantMap.set(episodeId, arr)

        const rawArr = epRawVariantMap.get(episodeId) ?? []
        rawArr.push(variant)
        epRawVariantMap.set(episodeId, rawArr)
      }

      return episodeRows.map((e): EpisodeResponse => {
        const availabilityCount = availCountMap.get(e.id) ?? 0
        const rawVariants = epRawVariantMap.get(e.id) ?? []
        const { selectedVariantId } = resolveVariant(rawVariants, prefs)
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
