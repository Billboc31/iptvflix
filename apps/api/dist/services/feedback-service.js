import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { explicitFeedback, movies, series } from '../db/schema/index.js';
import { NotFoundError } from '../errors.js';
function toItem(row) {
    return {
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        feedback: row.feedback,
        updatedAt: row.updatedAt.toISOString(),
    };
}
async function validateMediaId(mediaType, mediaId) {
    if (mediaType === 'MOVIE') {
        const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, mediaId));
        if (!row)
            throw new NotFoundError('Movie', mediaId);
    }
    else {
        const [row] = await db.select({ id: series.id }).from(series).where(eq(series.id, mediaId));
        if (!row)
            throw new NotFoundError('Series', mediaId);
    }
}
export async function upsertFeedback(profileId, mediaType, mediaId, feedback) {
    await validateMediaId(mediaType, mediaId);
    const now = new Date();
    const [row] = await db
        .insert(explicitFeedback)
        .values({ profileId, mediaType, mediaId, feedback, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
        target: [explicitFeedback.profileId, explicitFeedback.mediaType, explicitFeedback.mediaId],
        set: { feedback, updatedAt: now },
    })
        .returning();
    return toItem(row);
}
export async function removeFeedback(profileId, mediaType, mediaId) {
    await db
        .delete(explicitFeedback)
        .where(and(eq(explicitFeedback.profileId, profileId), eq(explicitFeedback.mediaType, mediaType), eq(explicitFeedback.mediaId, mediaId)));
}
export async function listFeedback(profileId) {
    const rows = await db
        .select()
        .from(explicitFeedback)
        .where(eq(explicitFeedback.profileId, profileId))
        .orderBy(desc(explicitFeedback.updatedAt));
    return rows.map(toItem);
}
//# sourceMappingURL=feedback-service.js.map