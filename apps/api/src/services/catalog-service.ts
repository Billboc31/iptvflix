import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type {
  GenreResponse,
  MovieFilters,
  MovieResponse,
  PaginatedList,
  SeriesFilters,
  SeriesResponse,
} from '@iptvflix/api-contracts'
import { mediaVideos } from '../db/schema/media-videos.js'

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
import { db } from '../db/client.js'
import {
  genres,
  movieAvailabilities,
  movieGenres,
  movies,
  seasons,
  series,
  seriesAvailabilities,
  seriesGenres,
} from '../db/schema/index.js'

export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`)
  }
}

export async function listMovies(filters: MovieFilters): Promise<PaginatedList<MovieResponse>> {
  const { q, genreId, year, availability, sortBy = 'title', page = 1, pageSize = 20 } = filters

  const conditions = []

  if (q) {
    const pattern = `%${q}%`
    conditions.push(or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern)))
  }
  if (year !== undefined) {
    conditions.push(eq(movies.year, year))
  }
  if (genreId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM movie_genres WHERE movie_id = ${movies.id} AND genre_id = ${genreId})`,
    )
  }
  if (availability === 'AVAILABLE') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM movie_availabilities WHERE movie_id = ${movies.id} AND status = 'AVAILABLE')`,
    )
  } else if (availability === 'UNAVAILABLE') {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM movie_availabilities WHERE movie_id = ${movies.id} AND status = 'AVAILABLE')`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [countRow] = await db.select({ value: count() }).from(movies).where(where)
  const total = Number(countRow.value)

  let orderByClause
  if (sortBy === 'year') {
    orderByClause = [desc(movies.year), asc(movies.title)]
  } else if (sortBy === 'recentAvailability') {
    orderByClause = [
      sql`(SELECT MAX(last_seen_at) FROM movie_availabilities WHERE movie_id = movies.id) DESC NULLS LAST`,
      asc(movies.title),
    ]
  } else {
    orderByClause = [asc(movies.title)]
  }

  const rows = await db
    .select()
    .from(movies)
    .where(where)
    .orderBy(...orderByClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  if (rows.length === 0) {
    return { items: [], total, page, pageSize }
  }

  const ids = rows.map((r) => r.id)

  const [genreRows, availCountRows, qualityRows, trailerRows] = await Promise.all([
    db
      .select({ movieId: movieGenres.movieId, name: genres.name })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(inArray(movieGenres.movieId, ids)),
    db
      .select({ movieId: movieAvailabilities.movieId, cnt: count() })
      .from(movieAvailabilities)
      .where(
        and(
          inArray(movieAvailabilities.movieId, ids),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .groupBy(movieAvailabilities.movieId),
    db
      .select({ movieId: movieAvailabilities.movieId, videoQuality: movieAvailabilities.videoQuality })
      .from(movieAvailabilities)
      .where(
        and(
          inArray(movieAvailabilities.movieId, ids),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      ),
    db
      .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, ids))),
  ])

  const genreMap = new Map<string, string[]>()
  for (const { movieId, name } of genreRows) {
    const arr = genreMap.get(movieId) ?? []
    arr.push(name)
    genreMap.set(movieId, arr)
  }

  const availCountMap = new Map<string, number>()
  for (const { movieId, cnt } of availCountRows) {
    availCountMap.set(movieId, Number(cnt))
  }

  const qualityBuckets = new Map<string, (string | null)[]>()
  for (const { movieId, videoQuality } of qualityRows) {
    const bucket = qualityBuckets.get(movieId) ?? []
    bucket.push(videoQuality)
    qualityBuckets.set(movieId, bucket)
  }

  const trailerKeyMap = new Map<string, string>()
  for (const { mediaId, youtubeKey } of trailerRows) {
    if (!trailerKeyMap.has(mediaId)) trailerKeyMap.set(mediaId, youtubeKey)
  }

  const items: MovieResponse[] = rows.map((m) => {
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
      availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      trailerKey: trailerKeyMap.get(m.id) ?? null,
      popularity: m.popularity ?? null,
      voteCount: m.voteCount ?? null,
      originalLanguage: m.originalLanguage ?? null,
      spokenLanguages: m.spokenLanguages ?? null,
      productionCountries: m.productionCountries ?? null,
      tagline: m.tagline ?? null,
      status: m.status ?? null,
      keywords: m.keywords ?? null,
      collection: null,
      externalIds: m.externalIds ?? null,
    }
  })

  return { items, total, page, pageSize }
}

export async function getMovie(id: string): Promise<MovieResponse | null> {
  const [row] = await db.select().from(movies).where(eq(movies.id, id))
  if (!row) return null

  const [genreRows, availCountRows, trailerRow] = await Promise.all([
    db
      .select({ name: genres.name })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(eq(movieGenres.movieId, id)),
    db
      .select({ cnt: count() })
      .from(movieAvailabilities)
      .where(and(eq(movieAvailabilities.movieId, id), eq(movieAvailabilities.status, 'AVAILABLE'))),
    db
      .select({ youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'movie'), eq(mediaVideos.mediaId, id)))
      .limit(1),
  ])

  const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)

  return {
    id: row.id,
    title: row.title,
    year: row.year,
    synopsis: row.synopsis,
    posterUrl: row.posterPath,
    backdropUrl: row.backdropPath,
    runtime: row.durationMinutes,
    genres: genreRows.map((g) => g.name),
    quality: null,
    availabilityCount,
    availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
    trailerKey: trailerRow[0]?.youtubeKey ?? null,
    popularity: row.popularity ?? null,
    voteCount: row.voteCount ?? null,
    originalLanguage: row.originalLanguage ?? null,
    spokenLanguages: row.spokenLanguages ?? null,
    productionCountries: row.productionCountries ?? null,
    tagline: row.tagline ?? null,
    status: row.status ?? null,
    keywords: row.keywords ?? null,
    collection: null,
    externalIds: row.externalIds ?? null,
  }
}

export async function listSeries(filters: SeriesFilters): Promise<PaginatedList<SeriesResponse>> {
  const { q, genreId, year, availability, sortBy = 'title', page = 1, pageSize = 20 } = filters

  const conditions = []

  if (q) {
    const pattern = `%${q}%`
    conditions.push(or(ilike(series.title, pattern), ilike(series.originalTitle, pattern)))
  }
  if (year !== undefined) {
    conditions.push(eq(series.firstAirYear, year))
  }
  if (genreId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM series_genres WHERE series_id = ${series.id} AND genre_id = ${genreId})`,
    )
  }
  if (availability === 'AVAILABLE') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM series_availabilities WHERE series_id = ${series.id} AND status = 'AVAILABLE')`,
    )
  } else if (availability === 'UNAVAILABLE') {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM series_availabilities WHERE series_id = ${series.id} AND status = 'AVAILABLE')`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [countRow] = await db.select({ value: count() }).from(series).where(where)
  const total = Number(countRow.value)

  let orderByClause
  if (sortBy === 'year') {
    orderByClause = [desc(series.firstAirYear), asc(series.title)]
  } else if (sortBy === 'recentAvailability') {
    orderByClause = [
      sql`(SELECT MAX(last_seen_at) FROM series_availabilities WHERE series_id = series.id) DESC NULLS LAST`,
      asc(series.title),
    ]
  } else {
    orderByClause = [asc(series.title)]
  }

  const rows = await db
    .select()
    .from(series)
    .where(where)
    .orderBy(...orderByClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  if (rows.length === 0) {
    return { items: [], total, page, pageSize }
  }

  const ids = rows.map((r) => r.id)

  const [genreRows, availCountRows, seasonCountRows] = await Promise.all([
    db
      .select({ seriesId: seriesGenres.seriesId, name: genres.name })
      .from(seriesGenres)
      .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
      .where(inArray(seriesGenres.seriesId, ids)),
    db
      .select({ seriesId: seriesAvailabilities.seriesId, cnt: count() })
      .from(seriesAvailabilities)
      .where(
        and(
          inArray(seriesAvailabilities.seriesId, ids),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .groupBy(seriesAvailabilities.seriesId),
    db
      .select({ seriesId: seasons.seriesId, cnt: count() })
      .from(seasons)
      .where(inArray(seasons.seriesId, ids))
      .groupBy(seasons.seriesId),
  ])

  const genreMap = new Map<string, string[]>()
  for (const { seriesId, name } of genreRows) {
    const arr = genreMap.get(seriesId) ?? []
    arr.push(name)
    genreMap.set(seriesId, arr)
  }

  const availCountMap = new Map<string, number>()
  for (const { seriesId, cnt } of availCountRows) {
    availCountMap.set(seriesId, Number(cnt))
  }

  const seasonMap = new Map<string, number>()
  for (const { seriesId, cnt } of seasonCountRows) {
    seasonMap.set(seriesId, Number(cnt))
  }

  const items: SeriesResponse[] = rows.map((s) => {
    const availabilityCount = availCountMap.get(s.id) ?? 0
    return {
      id: s.id,
      title: s.title,
      year: s.firstAirYear,
      synopsis: s.synopsis,
      posterUrl: s.posterPath,
      backdropUrl: s.backdropPath,
      genres: genreMap.get(s.id) ?? [],
      seasonCount: seasonMap.get(s.id) ?? 0,
      availabilityCount,
      availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      popularity: s.popularity ?? null,
      voteCount: s.voteCount ?? null,
      originalLanguage: s.originalLanguage ?? null,
      spokenLanguages: s.spokenLanguages ?? null,
      productionCountries: s.productionCountries ?? null,
      tagline: s.tagline ?? null,
      keywords: s.keywords ?? null,
      externalIds: s.externalIds ?? null,
      inProduction: s.inProduction ?? null,
      networks: s.networks ?? null,
      createdBy: s.createdBy ?? null,
      numberOfSeasons: s.numberOfSeasons ?? null,
      numberOfEpisodes: s.numberOfEpisodes ?? null,
    }
  })

  return { items, total, page, pageSize }
}

export async function getSeries(id: string): Promise<SeriesResponse | null> {
  const [row] = await db.select().from(series).where(eq(series.id, id))
  if (!row) return null

  const [genreRows, availCountRows, seasonCountRows] = await Promise.all([
    db
      .select({ name: genres.name })
      .from(seriesGenres)
      .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
      .where(eq(seriesGenres.seriesId, id)),
    db
      .select({ cnt: count() })
      .from(seriesAvailabilities)
      .where(
        and(eq(seriesAvailabilities.seriesId, id), eq(seriesAvailabilities.status, 'AVAILABLE')),
      ),
    db.select({ cnt: count() }).from(seasons).where(eq(seasons.seriesId, id)),
  ])

  const availabilityCount = Number(availCountRows[0]?.cnt ?? 0)

  return {
    id: row.id,
    title: row.title,
    year: row.firstAirYear,
    synopsis: row.synopsis,
    posterUrl: row.posterPath,
    backdropUrl: row.backdropPath,
    genres: genreRows.map((g) => g.name),
    seasonCount: Number(seasonCountRows[0]?.cnt ?? 0),
    availabilityCount,
    availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
    popularity: row.popularity ?? null,
    voteCount: row.voteCount ?? null,
    originalLanguage: row.originalLanguage ?? null,
    spokenLanguages: row.spokenLanguages ?? null,
    productionCountries: row.productionCountries ?? null,
    tagline: row.tagline ?? null,
    keywords: row.keywords ?? null,
    externalIds: row.externalIds ?? null,
    inProduction: row.inProduction ?? null,
    networks: row.networks ?? null,
    createdBy: row.createdBy ?? null,
    numberOfSeasons: row.numberOfSeasons ?? null,
    numberOfEpisodes: row.numberOfEpisodes ?? null,
  }
}

export async function searchContent(
  q: string,
): Promise<{ movies: MovieResponse[]; series: SeriesResponse[] }> {
  const pattern = `%${q}%`

  const [movieRows, seriesRows] = await Promise.all([
    db
      .select()
      .from(movies)
      .where(or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern)))
      .orderBy(asc(movies.title))
      .limit(20),
    db
      .select()
      .from(series)
      .where(or(ilike(series.title, pattern), ilike(series.originalTitle, pattern)))
      .orderBy(asc(series.title))
      .limit(20),
  ])

  const movieIds = movieRows.map((m) => m.id)
  const seriesIds = seriesRows.map((s) => s.id)

  const [mGenreRows, mAvailCountRows, mQualityRows, sGenreRows, sAvailCountRows, sSeasonCounts, mTrailerRows] =
    await Promise.all([
      movieIds.length > 0
        ? db
            .select({ movieId: movieGenres.movieId, name: genres.name })
            .from(movieGenres)
            .innerJoin(genres, eq(movieGenres.genreId, genres.id))
            .where(inArray(movieGenres.movieId, movieIds))
        : Promise.resolve([]),
      movieIds.length > 0
        ? db
            .select({ movieId: movieAvailabilities.movieId, cnt: count() })
            .from(movieAvailabilities)
            .where(
              and(
                inArray(movieAvailabilities.movieId, movieIds),
                eq(movieAvailabilities.status, 'AVAILABLE'),
              ),
            )
            .groupBy(movieAvailabilities.movieId)
        : Promise.resolve([]),
      movieIds.length > 0
        ? db
            .select({ movieId: movieAvailabilities.movieId, videoQuality: movieAvailabilities.videoQuality })
            .from(movieAvailabilities)
            .where(
              and(
                inArray(movieAvailabilities.movieId, movieIds),
                eq(movieAvailabilities.status, 'AVAILABLE'),
              ),
            )
        : Promise.resolve([]),
      seriesIds.length > 0
        ? db
            .select({ seriesId: seriesGenres.seriesId, name: genres.name })
            .from(seriesGenres)
            .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
            .where(inArray(seriesGenres.seriesId, seriesIds))
        : Promise.resolve([]),
      seriesIds.length > 0
        ? db
            .select({ seriesId: seriesAvailabilities.seriesId, cnt: count() })
            .from(seriesAvailabilities)
            .where(
              and(
                inArray(seriesAvailabilities.seriesId, seriesIds),
                eq(seriesAvailabilities.status, 'AVAILABLE'),
              ),
            )
            .groupBy(seriesAvailabilities.seriesId)
        : Promise.resolve([]),
      seriesIds.length > 0
        ? db
            .select({ seriesId: seasons.seriesId, cnt: count() })
            .from(seasons)
            .where(inArray(seasons.seriesId, seriesIds))
            .groupBy(seasons.seriesId)
        : Promise.resolve([]),
      movieIds.length > 0
        ? db
            .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
            .from(mediaVideos)
            .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds)))
        : Promise.resolve([]),
    ])

  const mGenreMap = new Map<string, string[]>()
  for (const { movieId, name } of mGenreRows) {
    const arr = mGenreMap.get(movieId) ?? []
    arr.push(name)
    mGenreMap.set(movieId, arr)
  }

  const mAvailCountMap = new Map<string, number>()
  for (const { movieId, cnt } of mAvailCountRows) {
    mAvailCountMap.set(movieId, Number(cnt))
  }

  const mQualityBuckets = new Map<string, (string | null)[]>()
  for (const { movieId, videoQuality } of mQualityRows) {
    const bucket = mQualityBuckets.get(movieId) ?? []
    bucket.push(videoQuality)
    mQualityBuckets.set(movieId, bucket)
  }

  const sGenreMap = new Map<string, string[]>()
  for (const { seriesId, name } of sGenreRows) {
    const arr = sGenreMap.get(seriesId) ?? []
    arr.push(name)
    sGenreMap.set(seriesId, arr)
  }

  const sAvailCountMap = new Map<string, number>()
  for (const { seriesId, cnt } of sAvailCountRows) {
    sAvailCountMap.set(seriesId, Number(cnt))
  }

  const sSeasonMap = new Map<string, number>()
  for (const { seriesId, cnt } of sSeasonCounts) {
    sSeasonMap.set(seriesId, Number(cnt))
  }

  const mTrailerKeyMap = new Map<string, string>()
  for (const { mediaId, youtubeKey } of mTrailerRows) {
    mTrailerKeyMap.set(mediaId, youtubeKey)
  }

  return {
    movies: movieRows.map((m) => {
      const availabilityCount = mAvailCountMap.get(m.id) ?? 0
      return {
        id: m.id,
        title: m.title,
        year: m.year,
        synopsis: m.synopsis,
        posterUrl: m.posterPath,
        backdropUrl: m.backdropPath,
        runtime: m.durationMinutes,
        genres: mGenreMap.get(m.id) ?? [],
        quality: bestQuality(mQualityBuckets.get(m.id) ?? []),
        availabilityCount,
        availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        trailerKey: mTrailerKeyMap.get(m.id) ?? null,
        popularity: m.popularity ?? null,
        voteCount: m.voteCount ?? null,
        originalLanguage: m.originalLanguage ?? null,
        spokenLanguages: m.spokenLanguages ?? null,
        productionCountries: m.productionCountries ?? null,
        tagline: m.tagline ?? null,
        status: m.status ?? null,
        keywords: m.keywords ?? null,
        collection: null,
        externalIds: m.externalIds ?? null,
      }
    }),
    series: seriesRows.map((s) => {
      const availabilityCount = sAvailCountMap.get(s.id) ?? 0
      return {
        id: s.id,
        title: s.title,
        year: s.firstAirYear,
        synopsis: s.synopsis,
        posterUrl: s.posterPath,
        backdropUrl: s.backdropPath,
        genres: sGenreMap.get(s.id) ?? [],
        seasonCount: sSeasonMap.get(s.id) ?? 0,
        availabilityCount,
        availabilityStatus: availabilityCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        popularity: s.popularity ?? null,
        voteCount: s.voteCount ?? null,
        originalLanguage: s.originalLanguage ?? null,
        spokenLanguages: s.spokenLanguages ?? null,
        productionCountries: s.productionCountries ?? null,
        tagline: s.tagline ?? null,
        keywords: s.keywords ?? null,
        externalIds: s.externalIds ?? null,
        inProduction: s.inProduction ?? null,
        networks: s.networks ?? null,
        createdBy: s.createdBy ?? null,
        numberOfSeasons: s.numberOfSeasons ?? null,
        numberOfEpisodes: s.numberOfEpisodes ?? null,
      }
    }),
  }
}

export async function listGenres(): Promise<GenreResponse[]> {
  return db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name))
}

export async function getMovieTmdbIds(movieIds: string[]): Promise<Set<string>> {
  if (movieIds.length === 0) return new Set()
  const rows = await db
    .select({ tmdbId: movies.tmdbId })
    .from(movies)
    .where(inArray(movies.id, movieIds))
  return new Set(rows.filter((r) => r.tmdbId !== null).map((r) => String(r.tmdbId)))
}

export async function getSeriesTmdbIds(seriesIds: string[]): Promise<Set<string>> {
  if (seriesIds.length === 0) return new Set()
  const rows = await db
    .select({ tmdbId: series.tmdbId })
    .from(series)
    .where(inArray(series.id, seriesIds))
  return new Set(rows.filter((r) => r.tmdbId !== null).map((r) => String(r.tmdbId)))
}
