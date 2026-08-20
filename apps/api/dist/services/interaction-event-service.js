import { eq, and, gte, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profileInteractionEvents } from '../db/schema/index.js';
import { ShelfInstanceService } from './shelf-instance-service.js';
import { ShelfFatigueService } from './shelf-fatigue-service.js';
const shelfInstanceSvc = new ShelfInstanceService(db);
const shelfFatigueSvc = new ShelfFatigueService(db);
export const ALLOWED_EVENT_TYPES = new Set([
    // Discovery / browsing
    'HOME_OPENED',
    'SHELF_IMPRESSION',
    'SHELF_VIEWED',
    'SHELF_ITEM_IMPRESSION',
    'SHELF_ITEM_OPENED',
    'DETAIL_OPENED',
    'TRAILER_PREVIEW_STARTED',
    'TRAILER_PREVIEW_COMPLETED',
    'PREVIEW_STARTED',
    'SEARCH_PERFORMED',
    'SEARCH_RESULT_IMPRESSION',
    'SEARCH_RESULT_OPENED',
    // Intent / explicit preference
    'MY_LIST_ADDED',
    'MY_LIST_REMOVED',
    'LIKED',
    'DISLIKED',
    'RATED',
    'CONTINUE_WATCHING_DISMISSED',
    'REMINDER_ADDED',
    'SHELF_ITEM_VISIBLE',
    // Playback
    'PLAY_STARTED',
    'PLAY_RESUMED',
    'PLAY_PAUSED',
    'PLAY_STOPPED',
    'PLAY_COMPLETED',
    'PLAY_ABANDONED',
    'SEEK_FORWARD',
    'SEEK_BACKWARD',
    'SKIP_INTRO',
    'SKIP_RECAP',
    'SKIP_OUTRO',
    'NEXT_EPISODE_AUTO',
    'NEXT_EPISODE_MANUAL',
    'SOURCE_SELECTED',
    'AUDIO_TRACK_SELECTED',
    'SUBTITLE_TRACK_SELECTED',
    'PLAYBACK_SPEED_CHANGED',
    'WATCHED_10_PERCENT',
    'WATCHED_25_PERCENT',
    'WATCHED_50_PERCENT',
    'WATCHED_75_PERCENT',
    'WATCHED_90_PERCENT',
    // Profile / settings
    'PROFILE_SELECTED',
    'PROFILE_PREFERENCE_CHANGED',
    'NEVER_STOP_ENABLED',
    'NEVER_STOP_DISABLED',
]);
const MAX_METADATA_BYTES = 4096;
function validateMetadata(meta) {
    if (!meta)
        return null;
    const json = JSON.stringify(meta);
    if (json.length > MAX_METADATA_BYTES) {
        console.warn('[interaction-events] metadataJson exceeds 4KB, truncating to null');
        return null;
    }
    return meta;
}
export async function recordEvent(profileId, event) {
    const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
    const key = event.idempotencyKey ?? null;
    if (key) {
        const [existing] = await db
            .select({ id: profileInteractionEvents.id })
            .from(profileInteractionEvents)
            .where(eq(profileInteractionEvents.idempotencyKey, key));
        if (existing)
            return;
    }
    await db.insert(profileInteractionEvents).values({
        profileId,
        mediaType: event.mediaType ?? null,
        mediaId: event.mediaId ?? null,
        episodeId: event.episodeId ?? null,
        eventType: event.eventType,
        occurredAt,
        positionMs: event.positionMs ?? null,
        durationMs: event.durationMs ?? null,
        shelfId: event.shelfId ?? null,
        shelfInstanceId: event.shelfInstanceId ?? null,
        deviceType: event.deviceType ?? null,
        sourceId: event.sourceId ?? null,
        metadataJson: validateMetadata(event.metadataJson),
        seriesId: event.seriesId ?? null,
        seasonId: event.seasonId ?? null,
        seasonNumber: event.seasonNumber ?? null,
        progressPercent: event.progressPercent ?? null,
        shelfConceptId: event.shelfConceptId ?? null,
        shelfPosition: event.shelfPosition ?? null,
        itemPositionInShelf: event.itemPositionInShelf ?? null,
        searchQueryNormalized: event.searchQueryNormalized ?? null,
        availabilityId: event.availabilityId ?? null,
        clientType: event.clientType ?? null,
        appVersion: event.appVersion ?? null,
        sessionId: event.sessionId ?? null,
        referrerSurface: event.referrerSurface ?? null,
        schemaVersion: event.schemaVersion ?? 1,
        idempotencyKey: key,
    });
    // Non-blocking side-effect dispatch — errors are logged but not thrown
    dispatchSideEffects(profileId, event, occurredAt).catch((err) => {
        console.error('[interaction-event] side-effect dispatch error', err);
    });
}
async function dispatchSideEffects(profileId, event, occurredAt) {
    const meta = (event.metadataJson ?? {});
    const shelfInstanceId = event.shelfInstanceId ?? (typeof meta.shelfInstanceId === 'string' ? meta.shelfInstanceId : null);
    const mediaId = event.mediaId ?? null;
    const mediaType = event.mediaType ?? null;
    if (event.eventType === 'SHELF_IMPRESSION') {
        if (!shelfInstanceId)
            return;
        const shelfConceptId = typeof meta.shelfConceptId === 'string' ? meta.shelfConceptId : null;
        await Promise.all([
            shelfInstanceSvc.markFirstDisplayed(shelfInstanceId, occurredAt),
            shelfConceptId
                ? shelfFatigueSvc.recordImpression(profileId, shelfConceptId, false)
                : Promise.resolve(),
        ]);
        return;
    }
    if (event.eventType === 'SHELF_ITEM_VISIBLE') {
        if (!shelfInstanceId || !mediaId || !mediaType)
            return;
        const shelfConceptId = typeof meta.shelfConceptId === 'string' ? meta.shelfConceptId : null;
        await Promise.all([
            shelfInstanceSvc.markItemVisible(shelfInstanceId, mediaId, mediaType),
            shelfConceptId
                ? shelfFatigueSvc.recordImpression(profileId, shelfConceptId, true)
                : Promise.resolve(),
        ]);
        return;
    }
    if (event.eventType === 'SHELF_ITEM_OPENED') {
        if (!shelfInstanceId || !mediaId || !mediaType)
            return;
        const shelfConceptId = typeof meta.shelfConceptId === 'string' ? meta.shelfConceptId : null;
        await Promise.all([
            shelfInstanceSvc.markItemOpened(shelfInstanceId, mediaId, mediaType, occurredAt),
            shelfConceptId
                ? shelfFatigueSvc.recordInteraction(profileId, shelfConceptId)
                : Promise.resolve(),
        ]);
        return;
    }
    if (event.eventType === 'PLAY_STARTED') {
        if (!mediaId || !mediaType)
            return;
        let resolvedShelfInstanceId = shelfInstanceId;
        // Attribution fallback: find the most recent SHELF_ITEM_OPENED within 30 minutes
        if (!resolvedShelfInstanceId) {
            const thirtyMinutesAgo = new Date(occurredAt.getTime() - 30 * 60 * 1000);
            const [recentOpen] = await db
                .select({
                shelfInstanceId: profileInteractionEvents.shelfInstanceId,
                metadataJson: profileInteractionEvents.metadataJson,
            })
                .from(profileInteractionEvents)
                .where(and(eq(profileInteractionEvents.profileId, profileId), eq(profileInteractionEvents.mediaId, mediaId), eq(profileInteractionEvents.eventType, 'SHELF_ITEM_OPENED'), gte(profileInteractionEvents.occurredAt, thirtyMinutesAgo)))
                .orderBy(desc(profileInteractionEvents.occurredAt))
                .limit(1);
            if (recentOpen) {
                const openMeta = (recentOpen.metadataJson ?? {});
                resolvedShelfInstanceId =
                    recentOpen.shelfInstanceId ??
                        (typeof openMeta.shelfInstanceId === 'string' ? openMeta.shelfInstanceId : null);
            }
        }
        if (resolvedShelfInstanceId) {
            await shelfInstanceSvc.markItemPlayed(resolvedShelfInstanceId, mediaId, mediaType, occurredAt);
        }
    }
}
export async function recordEventBatch(profileId, events) {
    for (const event of events) {
        try {
            if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType))
                continue;
            await recordEvent(profileId, event);
        }
        catch (err) {
            console.warn('[interaction-events] batch item failed:', event.eventType, err);
        }
    }
}
//# sourceMappingURL=interaction-event-service.js.map