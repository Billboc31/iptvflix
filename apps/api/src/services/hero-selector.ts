import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { explicitFeedback, movies, series, mediaVideos } from '../db/schema/index.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { HERO_MIN_SCORE } from '../config/env.js'
import type { HeroItem } from '@iptvflix/api-contracts'
import type { ShelfCandidateItem } from '../client/recommendation-engine-client.js'

export async function selectHero(
  profileId: string,
  candidates: ShelfCandidateItem[],
): Promise<HeroItem | null> {
  if (candidates.length === 0) return null

  const eligibleCandidates = candidates.filter(
    (c) => c.available && c.finalScore >= HERO_MIN_SCORE,
  )
  if (eligibleCandidates.length === 0) return null

  const dislikedRows = await db
    .select({ mediaId: explicitFeedback.mediaId })
    .from(explicitFeedback)
    .where(
      and(
        eq(explicitFeedback.profileId, profileId),
        eq(explicitFeedback.feedback, 'DISLIKE'),
      ),
    )
  const dislikedIds = new Set(dislikedRows.map((r) => r.mediaId))

  const nonDisliked = eligibleCandidates.filter((c) => !dislikedIds.has(c.mediaId))
  if (nonDisliked.length === 0) return null

  const movieIds = nonDisliked.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId)
  const seriesIds = nonDisliked.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId)

  const [movieRows, seriesRows, movieTrailers, seriesTrailers] = await Promise.all([
    movieIds.length > 0
      ? db
          .select({ id: movies.id, title: movies.title, synopsis: movies.synopsis, backdropPath: movies.backdropPath })
          .from(movies)
          .where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db
          .select({ id: series.id, title: series.title, synopsis: series.synopsis, backdropPath: series.backdropPath })
          .from(series)
          .where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db
          .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
          .from(mediaVideos)
          .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds)))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db
          .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
          .from(mediaVideos)
          .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
      : Promise.resolve([]),
  ])

  type EnrichEntry = { title: string; synopsis: string | null; backdropUrl: string | null; trailerKey: string | null }
  const enrichMap = new Map<string, EnrichEntry>()

  for (const r of movieRows) {
    enrichMap.set(r.id, { title: r.title, synopsis: r.synopsis ?? null, backdropUrl: resolveMediaImageUrl(r.backdropPath), trailerKey: null })
  }
  for (const r of seriesRows) {
    enrichMap.set(r.id, { title: r.title, synopsis: r.synopsis ?? null, backdropUrl: resolveMediaImageUrl(r.backdropPath), trailerKey: null })
  }
  for (const r of [...movieTrailers, ...seriesTrailers]) {
    const entry = enrichMap.get(r.mediaId)
    if (entry && !entry.trailerKey) entry.trailerKey = r.youtubeKey
  }

  for (const candidate of nonDisliked) {
    const enrichment = enrichMap.get(candidate.mediaId)
    if (!enrichment) continue
    if (!enrichment.title) continue
    if (!enrichment.backdropUrl) continue

    return {
      mediaId: candidate.mediaId,
      mediaType: candidate.mediaType as 'MOVIE' | 'SERIES',
      title: enrichment.title,
      synopsis: enrichment.synopsis,
      backdropUrl: enrichment.backdropUrl,
      availabilityStatus: 'available',
      trailerKey: enrichment.trailerKey,
    }
  }

  return null
}
