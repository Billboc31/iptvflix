import { and, eq, gte, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movieAvailabilities, movies, series, seriesAvailabilities } from '../db/schema/index.js'
import {
  NOUVEAUTES_CATALOG_MAX_AGE_YEARS,
  NOUVEAUTES_ITEMS_PER_SHELF,
  NOUVEAUTES_RELEASE_WINDOW_DAYS,
} from '../config/env.js'

export type NouveautesItem = {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  title: string
  posterPath: string | null
  score: number
}

function computeQualityPrior(voteAverage: number | null, popularity: number | null): number {
  return (voteAverage ?? 0) / 10 * 0.6 + Math.min((popularity ?? 0) / 100, 1) * 0.4
}

export async function buildNouveautesItems(options: {
  mediaType?: 'MOVIE' | 'SERIES'
  excludeIds?: Set<string>
  limit?: number
}): Promise<NouveautesItem[]> {
  const limit = options.limit ?? NOUVEAUTES_ITEMS_PER_SHELF
  const excludeIds = options.excludeIds ?? new Set<string>()
  const { mediaType } = options

  const now = Date.now()
  const windowCutoffStr = new Date(now - NOUVEAUTES_RELEASE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const catalogCutoff = new Date(now - 30 * 86_400_000)
  const currentYear = new Date(now).getFullYear()
  const minReleaseYear = currentYear - NOUVEAUTES_CATALOG_MAX_AGE_YEARS

  const scored = new Map<string, NouveautesItem>()

  function upsert(item: NouveautesItem): void {
    const existing = scored.get(item.mediaId)
    if (!existing || item.score > existing.score) scored.set(item.mediaId, item)
  }

  // ── Movies ────────────────────────────────────────────────────────────────
  if (!mediaType || mediaType === 'MOVIE') {
    // Tier 1: genuine release within NOUVEAUTES_RELEASE_WINDOW_DAYS
    const t1Movies = await db.selectDistinctOn([movies.id], {
      id: movies.id,
      title: movies.title,
      posterPath: movies.posterPath,
      theatricalReleaseDate: movies.theatricalReleaseDate,
      digitalReleaseDate: movies.digitalReleaseDate,
      voteAverage: movies.voteAverage,
      popularity: movies.popularity,
    })
      .from(movies)
      .innerJoin(movieAvailabilities, and(
        eq(movieAvailabilities.movieId, movies.id),
        eq(movieAvailabilities.status, 'AVAILABLE'),
      ))
      .where(sql`COALESCE(${movies.digitalReleaseDate}, ${movies.theatricalReleaseDate}) >= ${windowCutoffStr}`)
      .orderBy(movies.id)

    for (const row of t1Movies) {
      if (excludeIds.has(row.id)) continue
      const releaseDateStr = row.digitalReleaseDate ?? row.theatricalReleaseDate
      const releaseDate = releaseDateStr ? new Date(releaseDateStr).getTime() : now
      const daysSince = (now - releaseDate) / 86_400_000
      const recencyScore = Math.max(0, 1 - daysSince / NOUVEAUTES_RELEASE_WINDOW_DAYS)
      const score = recencyScore * 0.75 + computeQualityPrior(row.voteAverage, row.popularity) * 0.25
      upsert({ mediaId: row.id, mediaType: 'MOVIE', title: row.title, posterPath: row.posterPath ?? null, score })
    }

    // Tier 2: recent catalog arrival with bounded release age (multiplier 0.5)
    const t2Movies = await db.selectDistinctOn([movies.id], {
      id: movies.id,
      title: movies.title,
      posterPath: movies.posterPath,
      year: movies.year,
      theatricalReleaseDate: movies.theatricalReleaseDate,
      digitalReleaseDate: movies.digitalReleaseDate,
      createdAt: movies.createdAt,
      voteAverage: movies.voteAverage,
      popularity: movies.popularity,
    })
      .from(movies)
      .innerJoin(movieAvailabilities, and(
        eq(movieAvailabilities.movieId, movies.id),
        eq(movieAvailabilities.status, 'AVAILABLE'),
      ))
      .where(gte(movies.createdAt, catalogCutoff))
      .orderBy(movies.id)

    for (const row of t2Movies) {
      if (excludeIds.has(row.id)) continue
      const releaseYear = row.year
        ?? (row.theatricalReleaseDate ? new Date(row.theatricalReleaseDate).getFullYear() : null)
        ?? (row.digitalReleaseDate ? new Date(row.digitalReleaseDate).getFullYear() : null)
      if (releaseYear === null || releaseYear < minReleaseYear) continue
      const daysSince = (now - (row.createdAt?.getTime() ?? now)) / 86_400_000
      const recencyScore = Math.max(0, 1 - daysSince / 30)
      const score = recencyScore * 0.5 * 0.75 + computeQualityPrior(row.voteAverage, row.popularity) * 0.25
      upsert({ mediaId: row.id, mediaType: 'MOVIE', title: row.title, posterPath: row.posterPath ?? null, score })
    }
  }

  // ── Series ────────────────────────────────────────────────────────────────
  if (!mediaType || mediaType === 'SERIES') {
    // Tier 1: genuine release within window, or both dates null and firstAirYear is current/prior year
    const t1Series = await db.selectDistinctOn([series.id], {
      id: series.id,
      title: series.title,
      posterPath: series.posterPath,
      theatricalReleaseDate: series.theatricalReleaseDate,
      digitalReleaseDate: series.digitalReleaseDate,
      firstAirYear: series.firstAirYear,
      voteAverage: series.voteAverage,
      popularity: series.popularity,
    })
      .from(series)
      .innerJoin(seriesAvailabilities, and(
        eq(seriesAvailabilities.seriesId, series.id),
        eq(seriesAvailabilities.status, 'AVAILABLE'),
      ))
      .where(or(
        sql`COALESCE(${series.theatricalReleaseDate}, ${series.digitalReleaseDate}) >= ${windowCutoffStr}`,
        and(
          isNull(series.theatricalReleaseDate),
          isNull(series.digitalReleaseDate),
          gte(series.firstAirYear, currentYear - 1),
        ),
      ))
      .orderBy(series.id)

    for (const row of t1Series) {
      if (excludeIds.has(row.id)) continue
      let daysSince: number
      const releaseDateStr = row.theatricalReleaseDate ?? row.digitalReleaseDate
      if (releaseDateStr) {
        daysSince = (now - new Date(releaseDateStr).getTime()) / 86_400_000
      } else if (row.firstAirYear != null) {
        daysSince = (now - new Date(row.firstAirYear, 6, 1).getTime()) / 86_400_000
      } else {
        daysSince = 0
      }
      const recencyScore = Math.max(0, 1 - daysSince / NOUVEAUTES_RELEASE_WINDOW_DAYS)
      const score = recencyScore * 0.75 + computeQualityPrior(row.voteAverage, row.popularity) * 0.25
      upsert({ mediaId: row.id, mediaType: 'SERIES', title: row.title, posterPath: row.posterPath ?? null, score })
    }

    // Tier 2: recent catalog arrival with bounded release age (multiplier 0.5)
    const t2Series = await db.selectDistinctOn([series.id], {
      id: series.id,
      title: series.title,
      posterPath: series.posterPath,
      firstAirYear: series.firstAirYear,
      theatricalReleaseDate: series.theatricalReleaseDate,
      digitalReleaseDate: series.digitalReleaseDate,
      createdAt: series.createdAt,
      voteAverage: series.voteAverage,
      popularity: series.popularity,
    })
      .from(series)
      .innerJoin(seriesAvailabilities, and(
        eq(seriesAvailabilities.seriesId, series.id),
        eq(seriesAvailabilities.status, 'AVAILABLE'),
      ))
      .where(gte(series.createdAt, catalogCutoff))
      .orderBy(series.id)

    for (const row of t2Series) {
      if (excludeIds.has(row.id)) continue
      const releaseYear = row.firstAirYear
        ?? (row.theatricalReleaseDate ? new Date(row.theatricalReleaseDate).getFullYear() : null)
        ?? (row.digitalReleaseDate ? new Date(row.digitalReleaseDate).getFullYear() : null)
      if (releaseYear === null || releaseYear < minReleaseYear) continue
      const daysSince = (now - (row.createdAt?.getTime() ?? now)) / 86_400_000
      const recencyScore = Math.max(0, 1 - daysSince / 30)
      const score = recencyScore * 0.5 * 0.75 + computeQualityPrior(row.voteAverage, row.popularity) * 0.25
      upsert({ mediaId: row.id, mediaType: 'SERIES', title: row.title, posterPath: row.posterPath ?? null, score })
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
