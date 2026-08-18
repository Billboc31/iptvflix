import { resolveMediaImageUrl } from '../lib/tmdb-image.js';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mediaVideos } from '../db/schema/media-videos.js';
import { getShelf } from './shelf-service.js';
import { rankRecommendations } from './recommendation-ranking-service.js';
// Dedup strategy: a single rankRecommendations call is partitioned into shelves;
// no candidate can appear in both rec shelves; utility shelves are independent by intent.
// In-progress media from Continue Watching is excluded from rec shelves via post-filter.
export async function buildHome(profileId) {
    const [continueWatching, myList] = await Promise.all([
        getShelf('sys_continue_watching', profileId),
        getShelf('sys_my_list', profileId),
    ]);
    const inProgressIds = new Set(continueWatching.items.map((item) => item.mediaId));
    const recResult = await rankRecommendations(profileId, { limit: 60, includeSeen: false });
    const filtered = recResult.candidates.filter((c) => !inProgressIds.has(c.mediaId));
    const available = filtered.filter((c) => c.available);
    const upcoming = filtered.filter((c) => !c.available);
    const forYouCandidates = available.slice(0, 20);
    const upcomingCandidates = upcoming.slice(0, 10);
    const allCandidates = [...forYouCandidates, ...upcomingCandidates];
    const movieCandidateIds = allCandidates.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId);
    const seriesCandidateIds = allCandidates.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId);
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
    ]);
    const trailerKeyMap = new Map();
    for (const r of movieTrailerRows) {
        if (!trailerKeyMap.has(r.mediaId))
            trailerKeyMap.set(r.mediaId, r.youtubeKey);
    }
    for (const r of seriesTrailerRows) {
        if (!trailerKeyMap.has(r.mediaId))
            trailerKeyMap.set(r.mediaId, r.youtubeKey);
    }
    const forYouItems = forYouCandidates.map((c) => candidateToItem(c, trailerKeyMap));
    const upcomingItems = upcomingCandidates.map((c) => candidateToItem(c, trailerKeyMap));
    const shelves = [];
    if (continueWatching.items.length > 0) {
        shelves.push(continueWatching);
    }
    shelves.push({
        id: 'sys_rec_for_you',
        title: 'Recommandé pour toi',
        type: 'SYSTEM',
        layoutHint: 'ROW',
        items: forYouItems,
    });
    if (myList.items.length > 0) {
        shelves.push(myList);
    }
    if (upcomingItems.length >= 3) {
        shelves.push({
            id: 'sys_rec_upcoming',
            title: 'À découvrir',
            type: 'SYSTEM',
            layoutHint: 'ROW',
            items: upcomingItems,
        });
    }
    return { coldStart: recResult.coldStart, shelves };
}
function candidateToItem(c, trailerKeyMap) {
    return {
        mediaType: c.mediaType,
        mediaId: c.mediaId,
        title: c.title,
        posterUrl: resolveMediaImageUrl(c.posterPath),
        trailerKey: trailerKeyMap.get(c.mediaId) ?? null,
    };
}
//# sourceMappingURL=home-service.js.map