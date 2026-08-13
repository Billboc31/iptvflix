import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mediaVideos } from '../db/schema/media-videos.js'
import { getShelf } from './shelf-service.js'
import { rankRecommendations } from './recommendation-ranking-service.js'
import type { HomeResponse, ShelfResponse, ShelfItem, RecommendationCandidate } from '@iptvflix/api-contracts'

// Dedup strategy: a single rankRecommendations call is partitioned into shelves;
// no candidate can appear in both rec shelves; utility shelves are independent by intent.
// In-progress media from Continue Watching is excluded from rec shelves via post-filter.

export async function buildHome(profileId: string): Promise<HomeResponse> {
  const [continueWatching, myList] = await Promise.all([
    getShelf('sys_continue_watching', profileId),
    getShelf('sys_my_list', profileId),
  ])

  const inProgressIds = new Set(continueWatching.items.map((item) => item.mediaId))

  const recResult = await rankRecommendations(profileId, { limit: 60, includeSeen: false })

  const filtered = recResult.candidates.filter((c) => !inProgressIds.has(c.mediaId))

  const available = filtered.filter((c) => c.available)
  const upcoming = filtered.filter((c) => !c.available)

  const forYouCandidates = available.slice(0, 20)
  const upcomingCandidates = upcoming.slice(0, 10)
  const allCandidates = [...forYouCandidates, ...upcomingCandidates]

  const movieCandidateIds = allCandidates.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId)
  const seriesCandidateIds = allCandidates.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId)

  const [movieTrailerRows, seriesTrailerRows] = await Promise.all([
    movieCandidateIds.length > 0
      ? db
          .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
          .from(mediaVideos)
          .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieCandidateIds)))
      : Promise.resolve([]),
    seriesCandidateIds.length > 0
      ? db
          .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
          .from(mediaVideos)
          .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesCandidateIds)))
      : Promise.resolve([]),
  ])

  const trailerKeyMap = new Map<string, string>()
  for (const r of movieTrailerRows) {
    if (!trailerKeyMap.has(r.mediaId)) trailerKeyMap.set(r.mediaId, r.youtubeKey)
  }
  for (const r of seriesTrailerRows) {
    if (!trailerKeyMap.has(r.mediaId)) trailerKeyMap.set(r.mediaId, r.youtubeKey)
  }

  const forYouItems: ShelfItem[] = forYouCandidates.map((c) => candidateToItem(c, trailerKeyMap))
  const upcomingItems: ShelfItem[] = upcomingCandidates.map((c) => candidateToItem(c, trailerKeyMap))

  const shelves: ShelfResponse[] = []

  if (continueWatching.items.length > 0) {
    shelves.push(continueWatching)
  }

  shelves.push({
    id: 'sys_rec_for_you',
    title: 'Recommandé pour toi',
    type: 'SYSTEM',
    layoutHint: 'ROW',
    items: forYouItems,
  })

  if (myList.items.length > 0) {
    shelves.push(myList)
  }

  if (upcomingItems.length >= 3) {
    shelves.push({
      id: 'sys_rec_upcoming',
      title: 'À découvrir',
      type: 'SYSTEM',
      layoutHint: 'ROW',
      items: upcomingItems,
    })
  }

  return { coldStart: recResult.coldStart, shelves }
}

function candidateToItem(c: RecommendationCandidate, trailerKeyMap: Map<string, string>): ShelfItem {
  return {
    mediaType: c.mediaType,
    mediaId: c.mediaId,
    title: c.title,
    posterUrl: c.posterPath,
    trailerKey: trailerKeyMap.get(c.mediaId) ?? null,
  }
}
