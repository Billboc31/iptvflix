import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { followRelease } from '../db/schema/release-lifecycle.js';
function toEntry(row) {
    return {
        id: row.id,
        profileId: row.profileId,
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        followedAt: row.followedAt.toISOString(),
    };
}
export async function follow(profileId, mediaType, mediaId) {
    const [row] = await db
        .insert(followRelease)
        .values({ profileId, mediaType, mediaId })
        .onConflictDoNothing()
        .returning();
    if (!row) {
        const [existing] = await db
            .select()
            .from(followRelease)
            .where(and(eq(followRelease.profileId, profileId), eq(followRelease.mediaType, mediaType), eq(followRelease.mediaId, mediaId)));
        return toEntry(existing);
    }
    return toEntry(row);
}
export async function unfollow(profileId, mediaType, mediaId) {
    await db
        .delete(followRelease)
        .where(and(eq(followRelease.profileId, profileId), eq(followRelease.mediaType, mediaType), eq(followRelease.mediaId, mediaId)));
}
export async function listFollowed(profileId) {
    const rows = await db
        .select()
        .from(followRelease)
        .where(eq(followRelease.profileId, profileId))
        .orderBy(desc(followRelease.followedAt));
    return rows.map(toEntry);
}
export async function isFollowing(profileId, mediaType, mediaId) {
    const [row] = await db
        .select({ id: followRelease.id })
        .from(followRelease)
        .where(and(eq(followRelease.profileId, profileId), eq(followRelease.mediaType, mediaType), eq(followRelease.mediaId, mediaId)));
    return row !== undefined;
}
//# sourceMappingURL=follow-release-service.js.map