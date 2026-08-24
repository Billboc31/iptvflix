import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { moviesDiscoverySnapshots } from '../db/schema/index.js'

export type MoviesSnapshot = typeof moviesDiscoverySnapshots.$inferSelect

export async function getMoviesSnapshot(profileId: string): Promise<MoviesSnapshot | null> {
  const [row] = await db
    .select()
    .from(moviesDiscoverySnapshots)
    .where(eq(moviesDiscoverySnapshots.profileId, profileId))
    .limit(1)
  return row ?? null
}

export async function saveMoviesSnapshot(
  profileId: string,
  declaredShelfInstanceIds: string[],
  expiresAt: Date,
): Promise<void> {
  await db
    .insert(moviesDiscoverySnapshots)
    .values({ profileId, declaredShelfInstanceIds, expiresAt })
    .onConflictDoUpdate({
      target: moviesDiscoverySnapshots.profileId,
      set: {
        declaredShelfInstanceIds,
        expiresAt,
        generatedAt: sql`now()`,
        invalidatedAt: null,
      },
    })
}

export async function invalidateMoviesSnapshot(profileId: string): Promise<void> {
  await db
    .update(moviesDiscoverySnapshots)
    .set({ invalidatedAt: new Date() })
    .where(eq(moviesDiscoverySnapshots.profileId, profileId))
}

export function isMoviesSnapshotValid(snapshot: MoviesSnapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt > new Date()
}

export function isMoviesSnapshotStale(snapshot: MoviesSnapshot): boolean {
  if (snapshot.invalidatedAt !== null) return false
  return snapshot.expiresAt < new Date()
}
