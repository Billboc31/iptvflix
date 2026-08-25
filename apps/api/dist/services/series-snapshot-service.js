import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { seriesDiscoverySnapshots } from '../db/schema/index.js';
export async function getSeriesSnapshot(profileId) {
    const [row] = await db
        .select()
        .from(seriesDiscoverySnapshots)
        .where(eq(seriesDiscoverySnapshots.profileId, profileId))
        .limit(1);
    return row ?? null;
}
export async function saveSeriesSnapshot(profileId, sessionId, declaredShelfInstanceIds, expiresAt) {
    await db
        .insert(seriesDiscoverySnapshots)
        .values({
        profileId,
        sessionId,
        declaredShelfInstanceIds,
        expiresAt,
    })
        .onConflictDoUpdate({
        target: seriesDiscoverySnapshots.profileId,
        set: {
            sessionId,
            declaredShelfInstanceIds,
            expiresAt,
            generatedAt: sql `now()`,
            invalidatedAt: null,
        },
    });
}
export async function invalidateSeriesSnapshot(profileId) {
    await db
        .update(seriesDiscoverySnapshots)
        .set({ invalidatedAt: new Date() })
        .where(eq(seriesDiscoverySnapshots.profileId, profileId));
}
export function isSeriesSnapshotValid(snapshot) {
    if (snapshot.invalidatedAt !== null)
        return false;
    return snapshot.expiresAt > new Date();
}
export function isSeriesSnapshotStale(snapshot) {
    return snapshot.expiresAt < new Date();
}
//# sourceMappingURL=series-snapshot-service.js.map