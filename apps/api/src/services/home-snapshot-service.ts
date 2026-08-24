import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { homeDiscoverySnapshots } from '../db/schema/index.js'

export type Snapshot = typeof homeDiscoverySnapshots.$inferSelect

export async function getSnapshot(profileId: string): Promise<Snapshot | null> {
  const [row] = await db
    .select()
    .from(homeDiscoverySnapshots)
    .where(eq(homeDiscoverySnapshots.profileId, profileId))
    .limit(1)
  return row ?? null
}

export async function saveSnapshot(
  profileId: string,
  sessionId: string,
  declaredShelfInstanceIds: string[],
  expiresAt: Date,
  heroMediaId: string | null,
  heroMediaType: string | null,
): Promise<void> {
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
        generatedAt: sql`now()`,
        invalidatedAt: null,
      },
    })
}

export async function invalidateSnapshot(profileId: string): Promise<void> {
  await db
    .update(homeDiscoverySnapshots)
    .set({ invalidatedAt: new Date() })
    .where(eq(homeDiscoverySnapshots.profileId, profileId))
}

export function isSnapshotValid(snapshot: Snapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt > new Date()
}

export function isStale(snapshot: Snapshot): boolean {
  return snapshot.expiresAt < new Date()
}
