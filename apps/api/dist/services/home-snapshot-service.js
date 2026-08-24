import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { homeDiscoverySnapshots } from '../db/schema/index.js';
export async function getSnapshot(profileId) {
    const [row] = await db
        .select()
        .from(homeDiscoverySnapshots)
        .where(eq(homeDiscoverySnapshots.profileId, profileId))
        .limit(1);
    return row ?? null;
}
export async function saveSnapshot(profileId, sessionId, declaredShelfInstanceIds, expiresAt, heroMediaId, heroMediaType) {
    await db
        .insert(homeDiscoverySnapshots)
        .values({
        profileId,
        sessionId,
        declaredShelfInstanceIds,
        expiresAt,
        heroMediaId,
        heroMediaType,
    })
        .onConflictDoUpdate({
        target: homeDiscoverySnapshots.profileId,
        set: {
            sessionId,
            declaredShelfInstanceIds,
            expiresAt,
            heroMediaId,
            heroMediaType,
            generatedAt: sql `now()`,
            invalidatedAt: null,
        },
    });
}
export async function invalidateSnapshot(profileId) {
    await db
        .update(homeDiscoverySnapshots)
        .set({ invalidatedAt: new Date() })
        .where(eq(homeDiscoverySnapshots.profileId, profileId));
}
export function isSnapshotValid(snapshot) {
    if (snapshot.invalidatedAt !== null)
        return false;
    return snapshot.expiresAt > new Date();
}
export function isStale(snapshot) {
    return snapshot.expiresAt < new Date();
}
//# sourceMappingURL=home-snapshot-service.js.map