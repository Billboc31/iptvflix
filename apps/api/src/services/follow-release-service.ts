import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { followRelease } from '../db/schema/release-lifecycle.js'
import type { FollowReleaseEntry } from '@iptvflix/api-contracts'

type MediaType = 'MOVIE' | 'SERIES'

function toEntry(row: typeof followRelease.$inferSelect): FollowReleaseEntry {
  return {
    id: row.id,
    profileId: row.profileId,
    mediaType: row.mediaType as MediaType,
    mediaId: row.mediaId,
    followedAt: row.followedAt.toISOString(),
  }
}

export async function follow(
  profileId: string,
  mediaType: MediaType,
  mediaId: string,
): Promise<FollowReleaseEntry> {
  const [row] = await db
    .insert(followRelease)
    .values({ profileId, mediaType, mediaId })
    .onConflictDoNothing()
    .returning()

  if (!row) {
    const [existing] = await db
      .select()
      .from(followRelease)
      .where(
        and(
          eq(followRelease.profileId, profileId),
          eq(followRelease.mediaType, mediaType),
          eq(followRelease.mediaId, mediaId),
        ),
      )
    return toEntry(existing)
  }
  return toEntry(row)
}

export async function unfollow(
  profileId: string,
  mediaType: MediaType,
  mediaId: string,
): Promise<void> {
  await db
    .delete(followRelease)
    .where(
      and(
        eq(followRelease.profileId, profileId),
        eq(followRelease.mediaType, mediaType),
        eq(followRelease.mediaId, mediaId),
      ),
    )
}

export async function listFollowed(profileId: string): Promise<FollowReleaseEntry[]> {
  const rows = await db
    .select()
    .from(followRelease)
    .where(eq(followRelease.profileId, profileId))
    .orderBy(desc(followRelease.followedAt))
  return rows.map(toEntry)
}

export async function isFollowing(
  profileId: string,
  mediaType: MediaType,
  mediaId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: followRelease.id })
    .from(followRelease)
    .where(
      and(
        eq(followRelease.profileId, profileId),
        eq(followRelease.mediaType, mediaType),
        eq(followRelease.mediaId, mediaId),
      ),
    )
  return row !== undefined
}
