import type { FastifyInstance } from 'fastify'
import { and, count, eq, inArray, ilike, sql, asc } from 'drizzle-orm'
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
import type {
  MovieResponse,
  MovieDetailResponse,
  SeriesResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  EnrichmentStatus,
  AvailabilityStatus,
  PaginatedList,
  AvailabilityVariantResponse,
} from '@iptvflix/api-contracts'

const QUALITY_ORDER: Record<string, number> = { '4K': 3, '1080p': 2, '720p': 1, '480p': 0 }

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

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /movies
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: { genreId?: string; year?: string; page?: string; pageSize?: string }
  }>('/movies', async (request) => {
    const { genreId, year, page = '1', pageSize = '20' } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (pageNum - 1) * pageSizeNum

    const conditions = []
    if (year) {
      const yearNum = parseInt(year, 10)
      if (!isNaN(yearNum)) conditions.push(eq(movies.year, yearNum))
    }
    if (genreId) {
      conditions.push(
        sql`${movies.id} IN (SELECT movie_id FROM movie_genres WHERE genre_id = ${genreId})`,
      )
    }
    const whereClause = conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(movies)
      .where(whereClause)
    const total = Number(countRow?.total ?? 0)

    const movieRows = await db
      .select()
      .from(movies)
      .where(whereClause)
      .limit(pageSizeNum)
      .offset(offset)
      .orderBy(asc(movies.title))

    if (movieRows.length === 0) {
      return { items: [], total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<MovieResponse>
    }

    const movieIds = movieRows.map((m) => m.id)

    const genreRows = await db
      .select({ movieId: movieGenres.movieId, name: genres.name })
      .from(movieGenres)
      .leftJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(inArray(movieGenres.movieId, movieIds))

    const genreMap = new Map<string, string[]>()
    for (const row of genreRows) {
      if (!genreMap.has(row.movieId)) genreMap.set(row.movieId, [])
      if (row.name) genreMap.get(row.movieId)!.push(row.name)
    }

    const availCountRows = await db
      .select({ movieId: movieAvailabilities.movieId, cnt: count() })
      .from(movieAvailabilities)
      .where(
        and(
          inArray(movieAvailabilities.movieId, movieIds),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .groupBy(movieAvailabilities.movieId)
    const availCountMap = new Map(availCountRows.map((r) => [r.movieId, Number(r.cnt)]))

    const qualityRows = await db
      .select({ movieId: movieAvailabilities.movieId, videoQuality: movieAvailabilities.videoQuality })
      .from(movieAvailabilities)
      .where(
        and(
          inArray(movieAvailabilities.movieId, movieIds),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
    const qualityBuckets = new Map<string, (string | null)[]>()
    for (const { movieId, videoQuality } of qualityRows) {
      const bucket = qualityBuckets.get(movieId) ?? []
      bucket.push(videoQuality)
      qualityBuckets.set(movieId, bucket)
    }

    const items: MovieResponse[] = movieRows.map((m) => {
      const availabilityCount = availCountMap.get(m.id) ?? 0
      return {
        id: m.id,
        title: m.title,
        year: m.year,
        synopsis: m.synopsis,
        posterUrl: m.posterPath,
        backdropUrl: m.backdropPath,
        runtime: m.durationMinutes,
        genres: genreMap.get(m.id) ?? [],
        quality: bestQuality(qualityBuckets.get(m.id) ?? []),
        availabilityCount,
        availabilityStatus: (availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
      }
    })

    return { items, total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<MovieResponse>
  })

  // ---------------------------------------------------------------------------
  // GET /movies/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
    const { id } = request.params

    const [movie] = await db.select().from(movies).where(eq(movies.id, id))
    if (!movie) return reply.status(404).send({ error: 'Movie not found' })

    const genreRows = await db
      .select({ name: genres.name })
      .from(movieGenres)
      .leftJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(eq(movieGenres.movieId, id))

    const availCountRows = await db
      .select({ cnt: count() })
      .from(movieAvailabilities)
      .where(
        and(
          eq(movieAvailabilities.movieId, id),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)

    const variantRows = await db
      .select({
        id: movieAvailabilities.id,
        audioLanguage: movieAvailabilities.audioLanguage,
        subtitleLanguage: movieAvailabilities.subtitleLanguage,
        videoQuality: movieAvailabilities.videoQuality,
        rawTitle: movieAvailabilities.rawTitle,
      })
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, id))
    const variants: AvailabilityVariantResponse[] = variantRows

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
      variants,
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: { genreId?: string; year?: string; page?: string; pageSize?: string }
  }>('/series', async (request) => {
    const { genreId, year, page = '1', pageSize = '20' } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (pageNum - 1) * pageSizeNum

    const conditions = []
    if (year) {
      const yearNum = parseInt(year, 10)
      if (!isNaN(yearNum)) conditions.push(eq(seriesTable.firstAirYear, yearNum))
    }
    if (genreId) {
      conditions.push(
        sql`${seriesTable.id} IN (SELECT series_id FROM series_genres WHERE genre_id = ${genreId})`,
      )
    }
    const whereClause = conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(seriesTable)
      .where(whereClause)
    const total = Number(countRow?.total ?? 0)

    const seriesRows = await db
      .select()
      .from(seriesTable)
      .where(whereClause)
      .limit(pageSizeNum)
      .offset(offset)
      .orderBy(asc(seriesTable.title))

    if (seriesRows.length === 0) {
      return { items: [], total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<SeriesResponse>
    }

    const seriesIds = seriesRows.map((s) => s.id)

    const genreRows = await db
      .select({ seriesId: seriesGenres.seriesId, name: genres.name })
      .from(seriesGenres)
      .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
      .where(inArray(seriesGenres.seriesId, seriesIds))

    const genreMap = new Map<string, string[]>()
    for (const row of genreRows) {
      if (!genreMap.has(row.seriesId)) genreMap.set(row.seriesId, [])
      if (row.name) genreMap.get(row.seriesId)!.push(row.name)
    }

    const availCountRows = await db
      .select({ seriesId: seriesAvailabilities.seriesId, cnt: count() })
      .from(seriesAvailabilities)
      .where(
        and(
          inArray(seriesAvailabilities.seriesId, seriesIds),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .groupBy(seriesAvailabilities.seriesId)
    const availCountMap = new Map(availCountRows.map((r) => [r.seriesId, Number(r.cnt)]))

    const seasonCountRows = await db
      .select({
        seriesId: seasons.seriesId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(seasons)
      .where(inArray(seasons.seriesId, seriesIds))
      .groupBy(seasons.seriesId)
    const seasonCountMap = new Map(seasonCountRows.map((r) => [r.seriesId, Number(r.count)]))

    const items: SeriesResponse[] = seriesRows.map((s) => {
      const availabilityCount = availCountMap.get(s.id) ?? 0
      return {
        id: s.id,
        title: s.title,
        year: s.firstAirYear,
        synopsis: s.synopsis,
        posterUrl: s.posterPath,
        backdropUrl: s.backdropPath,
        genres: genreMap.get(s.id) ?? [],
        seasonCount: seasonCountMap.get(s.id) ?? 0,
        availabilityCount,
        availabilityStatus: (availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
      }
    })

    return { items, total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<SeriesResponse>
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/series/:id', async (request, reply) => {
    const { id } = request.params

    const [seriesRow] = await db.select().from(seriesTable).where(eq(seriesTable.id, id))
    if (!seriesRow) return reply.status(404).send({ error: 'Series not found' })

    const genreRows = await db
      .select({ name: genres.name })
      .from(seriesGenres)
      .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
      .where(eq(seriesGenres.seriesId, id))

    const availCountRows = await db
      .select({ cnt: count() })
      .from(seriesAvailabilities)
      .where(
        and(
          eq(seriesAvailabilities.seriesId, id),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
        ),
      )
    const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)

    const seasonRows = await db
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
      .orderBy(asc(seasons.seasonNumber))

    const seriesVariantRows = await db
      .select({
        id: seriesAvailabilities.id,
        audioLanguage: seriesAvailabilities.audioLanguage,
        subtitleLanguage: seriesAvailabilities.subtitleLanguage,
        videoQuality: seriesAvailabilities.videoQuality,
        rawTitle: seriesAvailabilities.rawTitle,
      })
      .from(seriesAvailabilities)
      .where(eq(seriesAvailabilities.seriesId, id))
    const seriesVariants: AvailabilityVariantResponse[] = seriesVariantRows

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
      seasons: seasonRows.map((s) => ({
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodeCount: Number(s.episodeCount),
        airYear: s.airYear,
      })),
      variants: seriesVariants,
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id/seasons/:seasonNumber/episodes
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string; seasonNumber: string } }>(
    '/series/:id/seasons/:seasonNumber/episodes',
    async (request, reply) => {
      const { id, seasonNumber } = request.params
      const seasonNum = parseInt(seasonNumber, 10)
      if (isNaN(seasonNum)) return reply.status(404).send({ error: 'Season not found' })

      const [season] = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.seriesId, id), eq(seasons.seasonNumber, seasonNum)))

      if (!season) return reply.status(404).send({ error: 'Season not found' })

      const episodeRows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.seasonId, season.id))
        .orderBy(asc(episodes.episodeNumber))

      if (episodeRows.length === 0) return []

      const episodeIds = episodeRows.map((e) => e.id)
      const availCountRows = await db
        .select({ episodeId: episodeAvailabilities.episodeId, cnt: count() })
        .from(episodeAvailabilities)
        .where(
          and(
            inArray(episodeAvailabilities.episodeId, episodeIds),
            eq(episodeAvailabilities.status, 'AVAILABLE'),
          ),
        )
        .groupBy(episodeAvailabilities.episodeId)
      const availCountMap = new Map(availCountRows.map((r) => [r.episodeId, Number(r.cnt)]))

      const epVariantRows = await db
        .select({
          episodeId: episodeAvailabilities.episodeId,
          id: episodeAvailabilities.id,
          audioLanguage: episodeAvailabilities.audioLanguage,
          subtitleLanguage: episodeAvailabilities.subtitleLanguage,
          videoQuality: episodeAvailabilities.videoQuality,
          rawTitle: episodeAvailabilities.rawTitle,
        })
        .from(episodeAvailabilities)
        .where(inArray(episodeAvailabilities.episodeId, episodeIds))
      const epVariantMap = new Map<string, AvailabilityVariantResponse[]>()
      for (const { episodeId, ...variant } of epVariantRows) {
        const arr = epVariantMap.get(episodeId) ?? []
        arr.push(variant)
        epVariantMap.set(episodeId, arr)
      }

      return episodeRows.map((e): EpisodeResponse => {
        const availabilityCount = availCountMap.get(e.id) ?? 0
        return {
          id: e.id,
          episodeNumber: e.episodeNumber,
          title: e.title,
          synopsis: e.synopsis,
          durationMinutes: e.durationMinutes,
          airDate: e.airDate,
          availabilityCount,
          availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
          variants: epVariantMap.get(e.id) ?? [],
        }
      })
    },
  )

  // ---------------------------------------------------------------------------
  // GET /search
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: { q?: string } }>('/search', async (request) => {
    const { q } = request.query
    if (!q) return { movies: [], series: [] }

    const searchPattern = `%${q}%`

    const movieRows = await db
      .select()
      .from(movies)
      .where(ilike(movies.title, searchPattern))
      .limit(10)

    const seriesRows = await db
      .select()
      .from(seriesTable)
      .where(ilike(seriesTable.title, searchPattern))
      .limit(10)

    const movieIds = movieRows.map((m) => m.id)
    const seriesIds = seriesRows.map((s) => s.id)

    const movieGenreMap = new Map<string, string[]>()
    const movieAvailCountMap = new Map<string, number>()
    const seriesGenreMap = new Map<string, string[]>()
    const seriesAvailCountMap = new Map<string, number>()
    const seasonCountMap = new Map<string, number>()

    const movieQualityMap = new Map<string, string | null>()
    if (movieIds.length > 0) {
      const mgRows = await db
        .select({ movieId: movieGenres.movieId, name: genres.name })
        .from(movieGenres)
        .leftJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(inArray(movieGenres.movieId, movieIds))
      for (const row of mgRows) {
        if (!movieGenreMap.has(row.movieId)) movieGenreMap.set(row.movieId, [])
        if (row.name) movieGenreMap.get(row.movieId)!.push(row.name)
      }
      const maRows = await db
        .select({ movieId: movieAvailabilities.movieId, cnt: count() })
        .from(movieAvailabilities)
        .where(
          and(
            inArray(movieAvailabilities.movieId, movieIds),
            eq(movieAvailabilities.status, 'AVAILABLE'),
          ),
        )
        .groupBy(movieAvailabilities.movieId)
      for (const r of maRows) movieAvailCountMap.set(r.movieId, Number(r.cnt))

      const mqRows = await db
        .select({ movieId: movieAvailabilities.movieId, videoQuality: movieAvailabilities.videoQuality })
        .from(movieAvailabilities)
        .where(
          and(
            inArray(movieAvailabilities.movieId, movieIds),
            eq(movieAvailabilities.status, 'AVAILABLE'),
          ),
        )
      const mqBuckets = new Map<string, (string | null)[]>()
      for (const { movieId, videoQuality } of mqRows) {
        const bucket = mqBuckets.get(movieId) ?? []
        bucket.push(videoQuality)
        mqBuckets.set(movieId, bucket)
      }
      for (const [movieId, qualities] of mqBuckets) {
        movieQualityMap.set(movieId, bestQuality(qualities))
      }
    }

    if (seriesIds.length > 0) {
      const sgRows = await db
        .select({ seriesId: seriesGenres.seriesId, name: genres.name })
        .from(seriesGenres)
        .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
        .where(inArray(seriesGenres.seriesId, seriesIds))
      for (const row of sgRows) {
        if (!seriesGenreMap.has(row.seriesId)) seriesGenreMap.set(row.seriesId, [])
        if (row.name) seriesGenreMap.get(row.seriesId)!.push(row.name)
      }
      const saRows = await db
        .select({ seriesId: seriesAvailabilities.seriesId, cnt: count() })
        .from(seriesAvailabilities)
        .where(
          and(
            inArray(seriesAvailabilities.seriesId, seriesIds),
            eq(seriesAvailabilities.status, 'AVAILABLE'),
          ),
        )
        .groupBy(seriesAvailabilities.seriesId)
      for (const r of saRows) seriesAvailCountMap.set(r.seriesId, Number(r.cnt))
      const scRows = await db
        .select({
          seriesId: seasons.seriesId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(seasons)
        .where(inArray(seasons.seriesId, seriesIds))
        .groupBy(seasons.seriesId)
      for (const r of scRows) seasonCountMap.set(r.seriesId, Number(r.count))
    }

    return {
      movies: movieRows.map((m): MovieResponse => {
        const availabilityCount = movieAvailCountMap.get(m.id) ?? 0
        return {
          id: m.id,
          title: m.title,
          year: m.year,
          synopsis: m.synopsis,
          posterUrl: m.posterPath,
          backdropUrl: m.backdropPath,
          runtime: m.durationMinutes,
          genres: movieGenreMap.get(m.id) ?? [],
          quality: movieQualityMap.get(m.id) ?? null,
          availabilityCount,
          availabilityStatus: (availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
        }
      }),
      series: seriesRows.map((s): SeriesResponse => {
        const availabilityCount = seriesAvailCountMap.get(s.id) ?? 0
        return {
          id: s.id,
          title: s.title,
          year: s.firstAirYear,
          synopsis: s.synopsis,
          posterUrl: s.posterPath,
          backdropUrl: s.backdropPath,
          genres: seriesGenreMap.get(s.id) ?? [],
          seasonCount: seasonCountMap.get(s.id) ?? 0,
          availabilityCount,
          availabilityStatus: (availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
        }
      }),
    }
  })
}
