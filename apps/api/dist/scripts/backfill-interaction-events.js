/**
 * One-shot backfill: creates synthetic interaction events from existing profile behavioral data.
 * All rows are tagged with schemaVersion=0 and metadataJson={origin:"backfill"}.
 * Run with: npx tsx src/scripts/backfill-interaction-events.ts
 */
import 'dotenv/config';
import { db } from '../db/client.js';
import { profileInteractionEvents, viewingProgress, watchlist, explicitFeedback } from '../db/schema/index.js';
const BACKFILL_META = { origin: 'backfill' };
const SCHEMA_VERSION = 0;
async function run() {
    console.log('[backfill] starting interaction event backfill');
    // --- viewing_progress → PLAY_COMPLETED or PLAY_STARTED ---
    const progressRows = await db.select().from(viewingProgress);
    let progressInserted = 0;
    for (const vp of progressRows) {
        if (vp.durationSeconds <= 0)
            continue;
        const ratio = vp.progressSeconds / vp.durationSeconds;
        if (ratio < 0.05)
            continue;
        const eventType = ratio >= 0.9 ? 'PLAY_COMPLETED' : 'PLAY_STARTED';
        const mediaType = vp.mediaType === 'MOVIE' ? 'MOVIE' : 'EPISODE';
        const idempotencyKey = `backfill:${vp.profileId}:${vp.mediaId}:${eventType}`;
        try {
            await db
                .insert(profileInteractionEvents)
                .values({
                profileId: vp.profileId,
                mediaType,
                mediaId: vp.mediaId,
                eventType,
                occurredAt: vp.lastWatchedAt,
                progressPercent: Math.round(ratio * 100),
                schemaVersion: SCHEMA_VERSION,
                metadataJson: BACKFILL_META,
                idempotencyKey,
            })
                .onConflictDoNothing();
            progressInserted++;
        }
        catch (err) {
            console.warn(`[backfill] skip progress ${vp.id}:`, err);
        }
    }
    console.log(`[backfill] viewing_progress: ${progressInserted}/${progressRows.length} inserted`);
    // --- watchlist → MY_LIST_ADDED ---
    const watchlistRows = await db.select().from(watchlist);
    let watchlistInserted = 0;
    for (const wl of watchlistRows) {
        const idempotencyKey = `backfill:${wl.profileId}:${wl.mediaId}:MY_LIST_ADDED`;
        try {
            await db
                .insert(profileInteractionEvents)
                .values({
                profileId: wl.profileId,
                mediaType: wl.mediaType,
                mediaId: wl.mediaId,
                eventType: 'MY_LIST_ADDED',
                occurredAt: wl.addedAt,
                schemaVersion: SCHEMA_VERSION,
                metadataJson: BACKFILL_META,
                idempotencyKey,
            })
                .onConflictDoNothing();
            watchlistInserted++;
        }
        catch (err) {
            console.warn(`[backfill] skip watchlist ${wl.id}:`, err);
        }
    }
    console.log(`[backfill] watchlist: ${watchlistInserted}/${watchlistRows.length} inserted`);
    // --- explicit_feedback → LIKED | DISLIKED ---
    const feedbackRows = await db.select().from(explicitFeedback);
    let feedbackInserted = 0;
    for (const fb of feedbackRows) {
        if (fb.feedback !== 'LIKE' && fb.feedback !== 'DISLIKE')
            continue;
        const eventType = fb.feedback === 'LIKE' ? 'LIKED' : 'DISLIKED';
        const idempotencyKey = `backfill:${fb.profileId}:${fb.mediaId}:${eventType}`;
        try {
            await db
                .insert(profileInteractionEvents)
                .values({
                profileId: fb.profileId,
                mediaType: fb.mediaType,
                mediaId: fb.mediaId,
                eventType,
                occurredAt: fb.createdAt,
                schemaVersion: SCHEMA_VERSION,
                metadataJson: BACKFILL_META,
                idempotencyKey,
            })
                .onConflictDoNothing();
            feedbackInserted++;
        }
        catch (err) {
            console.warn(`[backfill] skip feedback ${fb.id}:`, err);
        }
    }
    console.log(`[backfill] explicit_feedback: ${feedbackInserted}/${feedbackRows.length} inserted`);
    console.log('[backfill] done');
    process.exit(0);
}
run().catch((err) => {
    console.error('[backfill] fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=backfill-interaction-events.js.map