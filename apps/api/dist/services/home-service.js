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
    const forYouItems = available.slice(0, 20).map(candidateToItem);
    const upcomingItems = upcoming.slice(0, 10).map(candidateToItem);
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
function candidateToItem(c) {
    return {
        mediaType: c.mediaType,
        mediaId: c.mediaId,
        title: c.title,
        posterUrl: c.posterPath,
    };
}
//# sourceMappingURL=home-service.js.map