import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { moviesDiscoverySnapshots } from '../db/schema/index.js';
export async function getMoviesSnapshot(profileId) {
    const [row] = await db
        .select()
        .from(moviesDiscoverySnapshots)
        .where(eq(moviesDiscoverySnapshots.profileId, profileId))
        .limit(1);
    return row ?? null;
}
export async function saveMoviesSnapshot(profileId, declaredShelfInstanceIds, expiresAt) {
    await db
        .insert(moviesDiscoverySnapshots)
        .values({ profileId, declaredShelfInstanceIds, expiresAt })
        .onConflictDoUpdate({
        target: moviesDiscoverySnapshots.profileId,
        set: {
            declaredShelfInstanceIds,
            expiresAt,
            generatedAt: sql `now()`,
            invalidatedAt: null,
        },
    });
}
export async function invalidateMoviesSnapshot(profileId) {
    await db
        .update(moviesDiscoverySnapshots)
        .set({ invalidatedAt: new Date() })
        .where(eq(moviesDiscoverySnapshots.profileId, profileId));
}
export function isMoviesSnapshotValid(snapshot) {
    if (snapshot.invalidatedAt !== null)
        return false;
    return snapshot.expiresAt > new Date();
}
export function isMoviesSnapshotStale(snapshot) {
    if (snapshot.invalidatedAt !== null)
        return false;
    return snapshot.expiresAt < new Date();
}
//# sourceMappingURL=movies-snapshot-service.js.map