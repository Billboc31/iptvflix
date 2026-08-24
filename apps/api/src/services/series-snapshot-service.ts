import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { seriesDiscoverySnapshots } from '../db/schema/index.js'

export type SeriesSnapshot = typeof seriesDiscoverySnapshots.$inferSelect

export async function getSeriesSnapshot(profileId: string): Promise<SeriesSnapshot | null> {
  const [row] = await db
    .select()
    .from(seriesDiscoverySnapshots)
    .where(eq(seriesDiscoverySnapshots.profileId, profileId))
    .limit(1)
  return row ?? null
}

export async function saveSeriesSnapshot(
  profileId: string,
  sessionId: string,
  declaredShelfInstanceIds: string[],
  expiresAt: Date,
): Promise<void> {
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
        generatedAt: sql`now()`,
        invalidatedAt: null,
      },
    })
}

export async function invalidateSeriesSnapshot(profileId: string): Promise<void> {
  await db
    .update(seriesDiscoverySnapshots)
    .set({ invalidatedAt: new Date() })
    .where(eq(seriesDiscoverySnapshots.profileId, profileId))
}

export function isSeriesSnapshotValid(snapshot: SeriesSnapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt > new Date()
}

export function isSeriesSnapshotStale(snapshot: SeriesSnapshot): boolean {
  return snapshot.expiresAt < new Date()
}
