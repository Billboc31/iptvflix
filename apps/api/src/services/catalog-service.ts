import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type {
  GenreResponse,
  MovieFilters,
  MovieResponse,
  PaginatedList,
  SeriesFilters,
  SeriesResponse,
} from '@iptvflix/api-contracts'
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

  const [genreRows, availRows] = await Promise.all([
    db
      .select({ movieId: movieGenres.movieId, name: genres.name })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(inArray(movieGenres.movieId, ids)),
    db
      .select({ movieId: movieAvailabilities.movieId, status: movieAvailabilities.status })
      .from(movieAvailabilities)
      .where(inArray(movieAvailabilities.movieId, ids)),
  ])

  const genreMap = new Map<string, string[]>()
  for (const { movieId, name } of genreRows) {
    const arr = genreMap.get(movieId) ?? []
    arr.push(name)
    genreMap.set(movieId, arr)
  }

  const availMap = new Map<string, boolean>()
  for (const { movieId, status } of availRows) {
    if (status === 'AVAILABLE') availMap.set(movieId, true)
    else if (!availMap.has(movieId)) availMap.set(movieId, false)
  }

  const items: MovieResponse[] = rows.map((m) => ({
    id: m.id,
    title: m.title,
    year: m.year,
    synopsis: m.synopsis,
    posterUrl: m.posterPath,
    backdropUrl: m.backdropPath,
    runtime: m.durationMinutes,
    genres: genreMap.get(m.id) ?? [],
    quality: null,
    availabilityStatus: availMap.get(m.id) ? 'AVAILABLE' : 'UNAVAILABLE',
  }))

  return { items, total, page, pageSize }
}

export async function getMovie(id: string): Promise<MovieResponse | null> {
  const [row] = await db.select().from(movies).where(eq(movies.id, id))
  if (!row) return null

  const [genreRows, availRows] = await Promise.all([
    db
      .select({ name: genres.name })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(eq(movieGenres.movieId, id)),
    db
      .select({ status: movieAvailabilities.status })
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, id)),
  ])

  const isAvailable = availRows.some((a) => a.status === 'AVAILABLE')

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
    availabilityStatus: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
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

  const [genreRows, availRows, seasonCounts] = await Promise.all([
    db
      .select({ seriesId: seriesGenres.seriesId, name: genres.name })
      .from(seriesGenres)
      .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
      .where(inArray(seriesGenres.seriesId, ids)),
    db
      .select({ seriesId: seriesAvailabilities.seriesId, status: seriesAvailabilities.status })
      .from(seriesAvailabilities)
      .where(inArray(seriesAvailabilities.seriesId, ids)),
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

  const availMap = new Map<string, boolean>()
  for (const { seriesId, status } of availRows) {
    if (status === 'AVAILABLE') availMap.set(seriesId, true)
    else if (!availMap.has(seriesId)) availMap.set(seriesId, false)
  }

  const seasonMap = new Map<string, number>()
  for (const { seriesId, cnt } of seasonCounts) {
    seasonMap.set(seriesId, Number(cnt))
  }

  const items: SeriesResponse[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    year: s.firstAirYear,
    synopsis: s.synopsis,
    posterUrl: s.posterPath,
    backdropUrl: s.backdropPath,
    genres: genreMap.get(s.id) ?? [],
    seasonCount: seasonMap.get(s.id) ?? 0,
    availabilityStatus: availMap.get(s.id) ? 'AVAILABLE' : 'UNAVAILABLE',
  }))

  return { items, total, page, pageSize }
}

export async function getSeries(id: string): Promise<SeriesResponse | null> {
  const [row] = await db.select().from(series).where(eq(series.id, id))
  if (!row) return null

  const [genreRows, availRows, [seasonCountRow]] = await Promise.all([
    db
      .select({ name: genres.name })
      .from(seriesGenres)
      .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
      .where(eq(seriesGenres.seriesId, id)),
    db
      .select({ status: seriesAvailabilities.status })
      .from(seriesAvailabilities)
      .where(eq(seriesAvailabilities.seriesId, id)),
    db.select({ cnt: count() }).from(seasons).where(eq(seasons.seriesId, id)),
  ])

  const isAvailable = availRows.some((a) => a.status === 'AVAILABLE')

  return {
    id: row.id,
    title: row.title,
    year: row.firstAirYear,
    synopsis: row.synopsis,
    posterUrl: row.posterPath,
    backdropUrl: row.backdropPath,
    genres: genreRows.map((g) => g.name),
    seasonCount: Number(seasonCountRow?.cnt ?? 0),
    availabilityStatus: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
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

  const [mGenreRows, mAvailRows, sGenreRows, sAvailRows, sSeasonCounts] = await Promise.all([
    movieIds.length > 0
      ? db
          .select({ movieId: movieGenres.movieId, name: genres.name })
          .from(movieGenres)
          .innerJoin(genres, eq(movieGenres.genreId, genres.id))
          .where(inArray(movieGenres.movieId, movieIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db
          .select({ movieId: movieAvailabilities.movieId, status: movieAvailabilities.status })
          .from(movieAvailabilities)
          .where(inArray(movieAvailabilities.movieId, movieIds))
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
          .select({ seriesId: seriesAvailabilities.seriesId, status: seriesAvailabilities.status })
          .from(seriesAvailabilities)
          .where(inArray(seriesAvailabilities.seriesId, seriesIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db
          .select({ seriesId: seasons.seriesId, cnt: count() })
          .from(seasons)
          .where(inArray(seasons.seriesId, seriesIds))
          .groupBy(seasons.seriesId)
      : Promise.resolve([]),
  ])

  const mGenreMap = new Map<string, string[]>()
  for (const { movieId, name } of mGenreRows) {
    const arr = mGenreMap.get(movieId) ?? []
    arr.push(name)
    mGenreMap.set(movieId, arr)
  }

  const mAvailMap = new Map<string, boolean>()
  for (const { movieId, status } of mAvailRows) {
    if (status === 'AVAILABLE') mAvailMap.set(movieId, true)
    else if (!mAvailMap.has(movieId)) mAvailMap.set(movieId, false)
  }

  const sGenreMap = new Map<string, string[]>()
  for (const { seriesId, name } of sGenreRows) {
    const arr = sGenreMap.get(seriesId) ?? []
    arr.push(name)
    sGenreMap.set(seriesId, arr)
  }

  const sAvailMap = new Map<string, boolean>()
  for (const { seriesId, status } of sAvailRows) {
    if (status === 'AVAILABLE') sAvailMap.set(seriesId, true)
    else if (!sAvailMap.has(seriesId)) sAvailMap.set(seriesId, false)
  }

  const sSeasonMap = new Map<string, number>()
  for (const { seriesId, cnt } of sSeasonCounts) {
    sSeasonMap.set(seriesId, Number(cnt))
  }

  return {
    movies: movieRows.map((m) => ({
      id: m.id,
      title: m.title,
      year: m.year,
      synopsis: m.synopsis,
      posterUrl: m.posterPath,
      backdropUrl: m.backdropPath,
      runtime: m.durationMinutes,
      genres: mGenreMap.get(m.id) ?? [],
      quality: null,
      availabilityStatus: mAvailMap.get(m.id) ? 'AVAILABLE' : 'UNAVAILABLE',
    })),
    series: seriesRows.map((s) => ({
      id: s.id,
      title: s.title,
      year: s.firstAirYear,
      synopsis: s.synopsis,
      posterUrl: s.posterPath,
      backdropUrl: s.backdropPath,
      genres: sGenreMap.get(s.id) ?? [],
      seasonCount: sSeasonMap.get(s.id) ?? 0,
      availabilityStatus: sAvailMap.get(s.id) ? 'AVAILABLE' : 'UNAVAILABLE',
    })),
  }
}

export async function listGenres(): Promise<GenreResponse[]> {
  return db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name))
}
