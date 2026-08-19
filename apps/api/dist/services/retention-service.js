import { and, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profileInteractionEvents } from '../db/schema/index.js';
import { RETENTION_DAYS, SEARCH_QUERY_ANONYMIZE_DAYS } from '../config/retention.js';
const STANDARD_RETENTION_DAYS = RETENTION_DAYS.STANDARD ?? 730;
const ANALYTICS_TYPES = ['SHELF_IMPRESSION', 'SHELF_ITEM_IMPRESSION', 'HOME_OPENED'];
const STANDARD_TYPES = [
    'PLAY_STARTED', 'PLAY_PAUSED', 'PLAY_STOPPED', 'PLAY_RESUMED', 'PLAY_ABANDONED',
    'DETAIL_OPENED', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SKIP_INTRO', 'SKIP_RECAP',
    'SKIP_OUTRO', 'NEXT_EPISODE_AUTO', 'NEXT_EPISODE_MANUAL', 'SOURCE_SELECTED',
    'AUDIO_TRACK_SELECTED', 'SUBTITLE_TRACK_SELECTED', 'PLAYBACK_SPEED_CHANGED',
    'SHELF_VIEWED', 'SHELF_ITEM_OPENED', 'TRAILER_PREVIEW_STARTED', 'TRAILER_PREVIEW_COMPLETED',
    'PREVIEW_STARTED', 'SEARCH_RESULT_OPENED', 'CONTINUE_WATCHING_DISMISSED',
    'PROFILE_SELECTED', 'PROFILE_PREFERENCE_CHANGED', 'NEVER_STOP_ENABLED', 'NEVER_STOP_DISABLED',
    'WATCHED_10_PERCENT', 'WATCHED_25_PERCENT', 'WATCHED_50_PERCENT', 'WATCHED_75_PERCENT',
];
export async function runCompaction() {
    const now = Date.now();
    // Anonymize search queries older than 90 days
    const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000);
    const anonymizedRows = await db
        .update(profileInteractionEvents)
        .set({ searchQueryNormalized: null })
        .where(and(inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']), isNotNull(profileInteractionEvents.searchQueryNormalized), lt(profileInteractionEvents.occurredAt, searchCutoff)))
        .returning({ id: profileInteractionEvents.id });
    // Delete ANALYTICS events older than 90 days
    const analyticsCutoff = new Date(now - 90 * 86_400_000);
    const analyticsDeleted = await db
        .delete(profileInteractionEvents)
        .where(and(inArray(profileInteractionEvents.eventType, ANALYTICS_TYPES), lt(profileInteractionEvents.occurredAt, analyticsCutoff)))
        .returning({ id: profileInteractionEvents.id });
    // Delete STANDARD events older than 730 days
    const standardCutoff = new Date(now - STANDARD_RETENTION_DAYS * 86_400_000);
    const standardDeleted = await db
        .delete(profileInteractionEvents)
        .where(and(inArray(profileInteractionEvents.eventType, STANDARD_TYPES), lt(profileInteractionEvents.occurredAt, standardCutoff)))
        .returning({ id: profileInteractionEvents.id });
    return {
        deleted: analyticsDeleted.length + standardDeleted.length,
        anonymized: anonymizedRows.length,
    };
}
export async function getRetentionStats() {
    const now = Date.now();
    const analyticsCutoff = new Date(now - 90 * 86_400_000);
    const standardCutoff = new Date(now - STANDARD_RETENTION_DAYS * 86_400_000);
    const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000);
    const [[analyticsRow], [standardRow], [searchRow]] = await Promise.all([
        db
            .select({ c: sql `count(*)` })
            .from(profileInteractionEvents)
            .where(and(inArray(profileInteractionEvents.eventType, ANALYTICS_TYPES), lt(profileInteractionEvents.occurredAt, analyticsCutoff))),
        db
            .select({ c: sql `count(*)` })
            .from(profileInteractionEvents)
            .where(and(inArray(profileInteractionEvents.eventType, STANDARD_TYPES), lt(profileInteractionEvents.occurredAt, standardCutoff))),
        db
            .select({ c: sql `count(*)` })
            .from(profileInteractionEvents)
            .where(and(inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']), isNotNull(profileInteractionEvents.searchQueryNormalized), lt(profileInteractionEvents.occurredAt, searchCutoff))),
    ]);
    return {
        analyticsOverdue: Number(analyticsRow?.c ?? 0),
        standardOverdue: Number(standardRow?.c ?? 0),
        searchQueryOverdue: Number(searchRow?.c ?? 0),
    };
}
//# sourceMappingURL=retention-service.js.map