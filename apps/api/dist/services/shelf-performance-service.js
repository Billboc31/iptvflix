import { eq, and, gte, inArray } from 'drizzle-orm';
import { shelfInstances, shelfInstanceItems, profileMediaExposure } from '../db/schema/index.js';
export class ShelfPerformanceService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getConceptPerformance(profileId, shelfConceptId) {
        const instances = await this.db
            .select()
            .from(shelfInstances)
            .where(and(eq(shelfInstances.profileId, profileId), eq(shelfInstances.shelfConceptId, shelfConceptId)));
        const impressionCount = instances.length;
        if (impressionCount === 0) {
            return { shelfConceptId, profileId, impressionCount: 0, visibleRate: 0, openRate: 0, playRate: 0 };
        }
        const displayedCount = instances.filter((i) => i.firstDisplayedAt !== null).length;
        const visibleRate = displayedCount / impressionCount;
        const instanceIds = instances.map((i) => i.id);
        const items = await this.db
            .select()
            .from(shelfInstanceItems)
            .where(inArray(shelfInstanceItems.shelfInstanceId, instanceIds));
        const visibleItems = items.filter((i) => i.wasVisible);
        const openedItems = items.filter((i) => i.openedAt !== null);
        const playedItems = items.filter((i) => i.playedAt !== null);
        const openRate = visibleItems.length > 0 ? openedItems.length / visibleItems.length : 0;
        const playRate = openedItems.length > 0 ? playedItems.length / openedItems.length : 0;
        return { shelfConceptId, profileId, impressionCount, visibleRate, openRate, playRate };
    }
    async getProfileMediaExposureBatch(profileId, mediaIds) {
        if (mediaIds.length === 0)
            return new Map();
        const rows = await this.db
            .select()
            .from(profileMediaExposure)
            .where(and(eq(profileMediaExposure.profileId, profileId), inArray(profileMediaExposure.mediaId, mediaIds)));
        return new Map(rows.map((r) => [
            r.mediaId,
            {
                profileId: r.profileId,
                mediaType: r.mediaType,
                mediaId: r.mediaId,
                exposureCount: r.exposureCount,
                firstExposedAt: r.firstExposedAt.toISOString(),
                lastExposedAt: r.lastExposedAt.toISOString(),
                openCount: r.openCount,
                playCount: r.playCount,
                lastOpenedAt: r.lastOpenedAt?.toISOString() ?? null,
                lastPlayedAt: r.lastPlayedAt?.toISOString() ?? null,
                shownInConceptIds: r.shownInConceptIds ?? [],
            },
        ]));
    }
    async getRecentlyExposedMediaIds(profileId, hoursBack) {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
        const rows = await this.db
            .select({ mediaId: profileMediaExposure.mediaId })
            .from(profileMediaExposure)
            .where(and(eq(profileMediaExposure.profileId, profileId), gte(profileMediaExposure.lastExposedAt, since)));
        return rows.map((r) => r.mediaId);
    }
}
//# sourceMappingURL=shelf-performance-service.js.map