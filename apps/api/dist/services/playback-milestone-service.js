import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profileInteractionEvents } from '../db/schema/index.js';
export const MILESTONE_THRESHOLDS = {
    WATCHED_10_PERCENT: 10,
    WATCHED_25_PERCENT: 25,
    WATCHED_50_PERCENT: 50,
    WATCHED_75_PERCENT: 75,
    WATCHED_90_PERCENT: 90,
};
export const MILESTONE_TYPES = new Set([
    'WATCHED_10_PERCENT',
    'WATCHED_25_PERCENT',
    'WATCHED_50_PERCENT',
    'WATCHED_75_PERCENT',
    'WATCHED_90_PERCENT',
]);
export function milestoneForPercent(percent) {
    if (percent >= 90)
        return 'WATCHED_90_PERCENT';
    if (percent >= 75)
        return 'WATCHED_75_PERCENT';
    if (percent >= 50)
        return 'WATCHED_50_PERCENT';
    if (percent >= 25)
        return 'WATCHED_25_PERCENT';
    if (percent >= 10)
        return 'WATCHED_10_PERCENT';
    return null;
}
export async function emitMilestoneIfNew(profileId, mediaId, sessionId, milestone, mediaType, positionMs) {
    // Include sessionId in the key when available; fall back to per-profile+media key
    // so reloads within the same session don't re-insert a milestone.
    const idempotencyKey = sessionId
        ? `${profileId}:${mediaId}:${sessionId}:${milestone}`
        : `${profileId}:${mediaId}:${milestone}`;
    const [existing] = await db
        .select({ id: profileInteractionEvents.id })
        .from(profileInteractionEvents)
        .where(eq(profileInteractionEvents.idempotencyKey, idempotencyKey));
    if (existing)
        return;
    await db.insert(profileInteractionEvents).values({
        profileId,
        mediaId,
        mediaType,
        eventType: milestone,
        occurredAt: new Date(),
        sessionId: sessionId ?? null,
        positionMs: positionMs ?? null,
        progressPercent: MILESTONE_THRESHOLDS[milestone],
        schemaVersion: 1,
        idempotencyKey,
    });
}
//# sourceMappingURL=playback-milestone-service.js.map