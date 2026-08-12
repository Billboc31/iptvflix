import { eq, gt, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  profiles,
  profileTaste,
  movies,
  series as seriesTbl,
  movieGenres,
  seriesGenres,
  movieAvailabilities,
  seriesAvailabilities,
  viewingProgress,
  discoveryCandidate,
} from '../db/schema/index.js'
import type { RecommendationsResponse, RecommendationCandidate } from '@iptvflix/api-contracts'
import { NotFoundError } from '../errors.js'

type RankOpts = {
  mediaType?: 'MOVIE' | 'SERIES'
  availableToMe?: boolean
  includeSeen?: boolean
  limit?: number
}

type InternalCandidate = {
  mediaId: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'SERIES'
  source: 'LOCAL' | 'DISCOVERY'
  genreIds: string[]
  popularity: number | null
  voteAverage: number | null
}

export async function rankRecommendations(
  profileId: string,
  opts: RankOpts = {},
): Promise<RecommendationsResponse> {
  const { availableToMe = false, includeSeen = false, limit = 20 } = opts
  const clampedLimit = Math.min(Math.max(limit, 1), 100)

  const [
    profileRows,
    tasteRows,
    movieRows,
    seriesRows,
    movieGenreRows,
    seriesGenreRows,
    discoveryCandidateRows,
    movieAvailabilityRows,
    seriesAvailabilityRows,
    progressRows,
  ] = await Promise.all([
    db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, profileId)),
    db.select().from(profileTaste).where(eq(profileTaste.profileId, profileId)),
    db.select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath }).from(movies),
    db.select({ id: seriesTbl.id, title: seriesTbl.title, year: seriesTbl.firstAirYear, posterPath: seriesTbl.posterPath }).from(seriesTbl),
    db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId }).from(movieGenres),
    db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId }).from(seriesGenres),
    db.select().from(discoveryCandidate).where(gt(discoveryCandidate.expiresAt, new Date())),
    db.select({ movieId: movieAvailabilities.movieId }).from(movieAvailabilities).where(eq(movieAvailabilities.status, 'AVAILABLE')),
    db.select({ seriesId: seriesAvailabilities.seriesId }).from(seriesAvailabilities).where(eq(seriesAvailabilities.status, 'AVAILABLE')),
    db
      .select({
        mediaId: viewingProgress.mediaId,
        progressSeconds: viewingProgress.progressSeconds,
        durationSeconds: viewingProgress.durationSeconds,
      })
      .from(viewingProgress)
      .where(and(eq(viewingProgress.profileId, profileId), eq(viewingProgress.mediaType, 'MOVIE'))),
  ])

  if (profileRows.length === 0) throw new NotFoundError('Profile', profileId)

  const tasteRow = tasteRows[0]
  const coldStart = !tasteRow || tasteRow.signalCount === 0

  const genreScores = (tasteRow?.genreScores ?? {}) as Record<string, number>
  const genreMeta = (tasteRow?.genreMeta ?? {}) as Record<string, { slug: string; name: string }>
  const positiveMediaIds = new Set<string>(tasteRow?.positiveMediaIds ?? [])
  const negativeMediaIds = new Set<string>(tasteRow?.negativeMediaIds ?? [])

  const movieGenreMap = new Map<string, string[]>()
  for (const { movieId, genreId } of movieGenreRows) {
    const list = movieGenreMap.get(movieId) ?? []
    list.push(genreId)
    movieGenreMap.set(movieId, list)
  }

  const seriesGenreMap = new Map<string, string[]>()
  for (const { seriesId, genreId } of seriesGenreRows) {
    const list = seriesGenreMap.get(seriesId) ?? []
    list.push(genreId)
    seriesGenreMap.set(seriesId, list)
  }

  const availableMovieIds = new Set<string>(movieAvailabilityRows.map((r) => r.movieId))
  const availableSeriesIds = new Set<string>(seriesAvailabilityRows.map((r) => r.seriesId))

  const completedMovieIds = new Set<string>()
  for (const row of progressRows) {
    if (row.durationSeconds > 0 && row.progressSeconds / row.durationSeconds >= 0.9) {
      completedMovieIds.add(row.mediaId)
    }
  }

  const candidates: InternalCandidate[] = []
  const localMovieIds = new Set<string>()
  const localSeriesIds = new Set<string>()

  if (!opts.mediaType || opts.mediaType === 'MOVIE') {
    for (const m of movieRows) {
      localMovieIds.add(m.id)
      candidates.push({
        mediaId: m.id,
        title: m.title,
        year: m.year,
        posterPath: m.posterPath,
        mediaType: 'MOVIE',
        source: 'LOCAL',
        genreIds: movieGenreMap.get(m.id) ?? [],
        popularity: null,
        voteAverage: null,
      })
    }
  }

  if (!opts.mediaType || opts.mediaType === 'SERIES') {
    for (const s of seriesRows) {
      localSeriesIds.add(s.id)
      candidates.push({
        mediaId: s.id,
        title: s.title,
        year: s.year,
        posterPath: s.posterPath,
        mediaType: 'SERIES',
        source: 'LOCAL',
        genreIds: seriesGenreMap.get(s.id) ?? [],
        popularity: null,
        voteAverage: null,
      })
    }
  }

  for (const dc of discoveryCandidateRows) {
    const dcMediaType = dc.mediaType as 'MOVIE' | 'SERIES'

    if (opts.mediaType && dcMediaType !== opts.mediaType) continue

    if (dcMediaType === 'MOVIE' && dc.canonicalMovieId && localMovieIds.has(dc.canonicalMovieId)) continue
    if (dcMediaType === 'SERIES' && dc.canonicalSeriesId && localSeriesIds.has(dc.canonicalSeriesId)) continue

    const effectiveMediaId =
      dcMediaType === 'MOVIE' ? (dc.canonicalMovieId ?? dc.id) : (dc.canonicalSeriesId ?? dc.id)

    const genreIds =
      dcMediaType === 'MOVIE'
        ? (dc.canonicalMovieId ? (movieGenreMap.get(dc.canonicalMovieId) ?? []) : [])
        : (dc.canonicalSeriesId ? (seriesGenreMap.get(dc.canonicalSeriesId) ?? []) : [])

    candidates.push({
      mediaId: effectiveMediaId,
      title: dc.title,
      year: dc.year,
      posterPath: dc.posterPath,
      mediaType: dcMediaType,
      source: 'DISCOVERY',
      genreIds,
      popularity: dc.popularity,
      voteAverage: dc.voteAverage,
    })
  }

  const filtered = candidates.filter((c) => !negativeMediaIds.has(c.mediaId))

  type ScoredCandidate = InternalCandidate & { score: number; reasons: string[]; available: boolean }

  const scored: ScoredCandidate[] = filtered.map((c) => {
    const available =
      c.mediaType === 'MOVIE' ? availableMovieIds.has(c.mediaId) : availableSeriesIds.has(c.mediaId)

    const isCompletedMovie = c.mediaType === 'MOVIE' && completedMovieIds.has(c.mediaId)
    const seenPenalty = isCompletedMovie && !includeSeen ? -10.0 : 0

    let score: number
    let reasons: string[]

    if (coldStart) {
      score = (c.popularity ?? 0) * (c.voteAverage ?? 0)
      reasons = ['popular pick']
    } else {
      const genreAffinity = c.genreIds.reduce((sum, gId) => sum + (genreScores[gId] ?? 0), 0)
      const positiveBonus = positiveMediaIds.has(c.mediaId) ? 5.0 : 0
      score = genreAffinity + positiveBonus + seenPenalty

      const matchedGenreNames: string[] = []
      for (const gId of c.genreIds) {
        const gs = genreScores[gId]
        if (gs != null && gs > 0) {
          const meta = genreMeta[gId]
          if (meta) matchedGenreNames.push(meta.name)
        }
      }

      if (positiveMediaIds.has(c.mediaId)) {
        reasons = ['liked', ...matchedGenreNames]
      } else if (matchedGenreNames.length > 0) {
        reasons = matchedGenreNames
      } else {
        reasons = ['discovery']
      }
    }

    return { ...c, score, reasons, available }
  })

  const visible = availableToMe ? scored.filter((c) => c.available) : scored

  visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.mediaId.localeCompare(b.mediaId)
  })

  const limited = visible.slice(0, clampedLimit)

  const outputCandidates: RecommendationCandidate[] = limited.map((c) => ({
    mediaType: c.mediaType,
    mediaId: c.mediaId,
    title: c.title,
    year: c.year,
    posterPath: c.posterPath,
    score: c.score,
    reasons: c.reasons,
    source: c.source,
    available: c.available,
  }))

  return {
    profileId,
    coldStart,
    candidates: outputCandidates,
  }
}
