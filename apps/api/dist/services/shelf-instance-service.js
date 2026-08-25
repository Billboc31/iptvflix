import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { shelfInstances, shelfInstanceItems, profileMediaExposure } from '../db/schema/index.js';
export class ShelfInstanceService {
    db;
    constructor(db) {
        this.db = db;
    }
    async persistShelfInstance(params) {
        return await this.db.transaction(async (tx) => {
            const [instance] = await tx
                .insert(shelfInstances)
                .values({
                profileId: params.profileId,
                shelfConceptId: params.shelfConceptId,
                title: params.title,
                semanticIntentSnapshot: params.semanticIntentSnapshot ?? null,
                generationType: params.generationType ?? null,
                generationReasonCodes: params.generationReasonCodes ?? [],
                homeSessionId: params.homeSessionId ?? null,
                seriesSessionId: params.seriesSessionId ?? null,
                moviesSessionId: params.moviesSessionId ?? null,
                verticalPosition: params.verticalPosition ?? null,
                rankerVersion: params.rankerVersion,
                queryPlannerVersion: params.queryPlannerVersion,
                embeddingModelVersion: params.embeddingModelVersion,
                candidateCount: params.candidateCount ?? null,
                finalItemCount: params.items.length,
                latencyMs: params.latencyMs ?? null,
                cacheHit: params.cacheHit ?? false,
                expiresAt: params.expiresAt ?? null,
                servedAt: params.servedAt ?? null,
            })
                .returning({ id: shelfInstances.id });
            if (params.items.length > 0) {
                await tx.insert(shelfInstanceItems).values(params.items.map((item) => ({
                    shelfInstanceId: instance.id,
                    mediaType: item.mediaType,
                    mediaId: item.mediaId,
                    rankPosition: item.rankPosition,
                    semanticScore: item.semanticScore ?? null,
                    profileScore: item.profileScore ?? null,
                    finalScore: item.finalScore ?? null,
                    diversityAdjustment: item.diversityAdjustment ?? null,
                    availabilityStatus: item.availabilityStatus ?? null,
                    reasonCodes: item.reasonCodes ?? [],
                    wasEligibleAtGeneration: item.wasEligibleAtGeneration ?? true,
                })));
            }
            return instance.id;
        });
    }
    async markFirstDisplayed(shelfInstanceId, at = new Date()) {
        const [instance] = await this.db
            .update(shelfInstances)
            .set({
            firstDisplayedAt: sql `COALESCE(${shelfInstances.firstDisplayedAt}, ${at.toISOString()}::timestamptz)`,
            lastDisplayedAt: at,
        })
            .where(eq(shelfInstances.id, shelfInstanceId))
            .returning({
            profileId: shelfInstances.profileId,
            shelfConceptId: shelfInstances.shelfConceptId,
        });
        if (!instance)
            return;
        const items = await this.db
            .select({
            mediaType: shelfInstanceItems.mediaType,
            mediaId: shelfInstanceItems.mediaId,
        })
            .from(shelfInstanceItems)
            .where(eq(shelfInstanceItems.shelfInstanceId, shelfInstanceId));
        if (items.length === 0)
            return;
        const conceptId = instance.shelfConceptId;
        await this.db
            .insert(profileMediaExposure)
            .values(items.map((item) => ({
            profileId: instance.profileId,
            mediaType: item.mediaType,
            mediaId: item.mediaId,
            exposureCount: 1,
            firstExposedAt: at,
            lastExposedAt: at,
            shownInConceptIds: conceptId ? [conceptId] : [],
        })))
            .onConflictDoUpdate({
            target: [
                profileMediaExposure.profileId,
                profileMediaExposure.mediaType,
                profileMediaExposure.mediaId,
            ],
            set: {
                exposureCount: sql `${profileMediaExposure.exposureCount} + 1`,
                lastExposedAt: at,
                shownInConceptIds: conceptId
                    ? sql `CASE WHEN ${profileMediaExposure.shownInConceptIds} @> ${JSON.stringify([conceptId])}::jsonb THEN ${profileMediaExposure.shownInConceptIds} ELSE ${profileMediaExposure.shownInConceptIds} || ${JSON.stringify([conceptId])}::jsonb END`
                    : profileMediaExposure.shownInConceptIds,
            },
        });
    }
    async markItemVisible(shelfInstanceId, mediaId, mediaType) {
        await this.db
            .update(shelfInstanceItems)
            .set({ wasVisible: true })
            .where(and(eq(shelfInstanceItems.shelfInstanceId, shelfInstanceId), eq(shelfInstanceItems.mediaId, mediaId), eq(shelfInstanceItems.mediaType, mediaType)));
    }
    async markItemOpened(shelfInstanceId, mediaId, mediaType, at) {
        await this.db
            .update(shelfInstanceItems)
            .set({ openedAt: at })
            .where(and(eq(shelfInstanceItems.shelfInstanceId, shelfInstanceId), eq(shelfInstanceItems.mediaId, mediaId), eq(shelfInstanceItems.mediaType, mediaType), isNull(shelfInstanceItems.openedAt)));
        const [instance] = await this.db
            .select({ profileId: shelfInstances.profileId })
            .from(shelfInstances)
            .where(eq(shelfInstances.id, shelfInstanceId))
            .limit(1);
        if (!instance)
            return;
        await this.db
            .update(profileMediaExposure)
            .set({
            openCount: sql `${profileMediaExposure.openCount} + 1`,
            lastOpenedAt: at,
        })
            .where(and(eq(profileMediaExposure.profileId, instance.profileId), eq(profileMediaExposure.mediaType, mediaType), eq(profileMediaExposure.mediaId, mediaId)));
    }
    async markItemPlayed(shelfInstanceId, mediaId, mediaType, at) {
        await this.db
            .update(shelfInstanceItems)
            .set({ playedAt: at })
            .where(and(eq(shelfInstanceItems.shelfInstanceId, shelfInstanceId), eq(shelfInstanceItems.mediaId, mediaId), eq(shelfInstanceItems.mediaType, mediaType), isNull(shelfInstanceItems.playedAt)));
        const [instance] = await this.db
            .select({ profileId: shelfInstances.profileId })
            .from(shelfInstances)
            .where(eq(shelfInstances.id, shelfInstanceId))
            .limit(1);
        if (!instance)
            return;
        await this.db
            .update(profileMediaExposure)
            .set({
            playCount: sql `${profileMediaExposure.playCount} + 1`,
            lastPlayedAt: at,
        })
            .where(and(eq(profileMediaExposure.profileId, instance.profileId), eq(profileMediaExposure.mediaType, mediaType), eq(profileMediaExposure.mediaId, mediaId)));
    }
    async getShelfInstanceWithItems(id) {
        const [instance] = await this.db
            .select()
            .from(shelfInstances)
            .where(eq(shelfInstances.id, id))
            .limit(1);
        if (!instance)
            return null;
        const items = await this.db
            .select()
            .from(shelfInstanceItems)
            .where(eq(shelfInstanceItems.shelfInstanceId, id))
            .orderBy(shelfInstanceItems.rankPosition);
        return {
            id: instance.id,
            profileId: instance.profileId,
            shelfConceptId: instance.shelfConceptId ?? null,
            title: instance.title,
            semanticIntentSnapshot: instance.semanticIntentSnapshot ?? null,
            generationType: instance.generationType ?? null,
            generationReasonCodes: instance.generationReasonCodes ?? [],
            homeSessionId: instance.homeSessionId ?? null,
            verticalPosition: instance.verticalPosition ?? null,
            rankerVersion: instance.rankerVersion,
            queryPlannerVersion: instance.queryPlannerVersion,
            embeddingModelVersion: instance.embeddingModelVersion,
            candidateCount: instance.candidateCount ?? null,
            finalItemCount: instance.finalItemCount ?? null,
            latencyMs: instance.latencyMs ?? null,
            cacheHit: instance.cacheHit,
            createdAt: instance.createdAt.toISOString(),
            firstDisplayedAt: instance.firstDisplayedAt?.toISOString() ?? null,
            lastDisplayedAt: instance.lastDisplayedAt?.toISOString() ?? null,
            expiresAt: instance.expiresAt?.toISOString() ?? null,
            items: items.map((item) => ({
                id: item.id,
                shelfInstanceId: item.shelfInstanceId,
                mediaType: item.mediaType,
                mediaId: item.mediaId,
                rankPosition: item.rankPosition,
                semanticScore: item.semanticScore ?? null,
                profileScore: item.profileScore ?? null,
                finalScore: item.finalScore ?? null,
                diversityAdjustment: item.diversityAdjustment ?? null,
                availabilityStatus: item.availabilityStatus ?? null,
                reasonCodes: item.reasonCodes ?? [],
                wasEligibleAtGeneration: item.wasEligibleAtGeneration,
                wasVisible: item.wasVisible,
                openedAt: item.openedAt?.toISOString() ?? null,
                playedAt: item.playedAt?.toISOString() ?? null,
            })),
        };
    }
    async listProfileShelfInstances(profileId, limit, before) {
        let query = this.db
            .select()
            .from(shelfInstances)
            .where(eq(shelfInstances.profileId, profileId))
            .orderBy(sql `${shelfInstances.createdAt} DESC`)
            .limit(limit);
        if (before) {
            query = this.db
                .select()
                .from(shelfInstances)
                .where(and(eq(shelfInstances.profileId, profileId), sql `${shelfInstances.createdAt} < ${new Date(before).toISOString()}::timestamptz`))
                .orderBy(sql `${shelfInstances.createdAt} DESC`)
                .limit(limit);
        }
        const rows = await query;
        if (rows.length === 0)
            return [];
        const instanceIds = rows.map((r) => r.id);
        const allItems = await this.db
            .select()
            .from(shelfInstanceItems)
            .where(inArray(shelfInstanceItems.shelfInstanceId, instanceIds))
            .orderBy(shelfInstanceItems.rankPosition);
        const itemsByInstance = new Map();
        for (const item of allItems) {
            const list = itemsByInstance.get(item.shelfInstanceId) ?? [];
            list.push(item);
            itemsByInstance.set(item.shelfInstanceId, list);
        }
        return rows.map((instance) => {
            const items = itemsByInstance.get(instance.id) ?? [];
            return {
                id: instance.id,
                profileId: instance.profileId,
                shelfConceptId: instance.shelfConceptId ?? null,
                title: instance.title,
                semanticIntentSnapshot: instance.semanticIntentSnapshot ?? null,
                generationType: instance.generationType ?? null,
                generationReasonCodes: instance.generationReasonCodes ?? [],
                homeSessionId: instance.homeSessionId ?? null,
                verticalPosition: instance.verticalPosition ?? null,
                rankerVersion: instance.rankerVersion,
                queryPlannerVersion: instance.queryPlannerVersion,
                embeddingModelVersion: instance.embeddingModelVersion,
                candidateCount: instance.candidateCount ?? null,
                finalItemCount: instance.finalItemCount ?? null,
                latencyMs: instance.latencyMs ?? null,
                cacheHit: instance.cacheHit,
                createdAt: instance.createdAt.toISOString(),
                firstDisplayedAt: instance.firstDisplayedAt?.toISOString() ?? null,
                lastDisplayedAt: instance.lastDisplayedAt?.toISOString() ?? null,
                expiresAt: instance.expiresAt?.toISOString() ?? null,
                items: items.map((item) => ({
                    id: item.id,
                    shelfInstanceId: item.shelfInstanceId,
                    mediaType: item.mediaType,
                    mediaId: item.mediaId,
                    rankPosition: item.rankPosition,
                    semanticScore: item.semanticScore ?? null,
                    profileScore: item.profileScore ?? null,
                    finalScore: item.finalScore ?? null,
                    diversityAdjustment: item.diversityAdjustment ?? null,
                    availabilityStatus: item.availabilityStatus ?? null,
                    reasonCodes: item.reasonCodes ?? [],
                    wasEligibleAtGeneration: item.wasEligibleAtGeneration,
                    wasVisible: item.wasVisible,
                    openedAt: item.openedAt?.toISOString() ?? null,
                    playedAt: item.playedAt?.toISOString() ?? null,
                })),
            };
        });
    }
}
//# sourceMappingURL=shelf-instance-service.js.map