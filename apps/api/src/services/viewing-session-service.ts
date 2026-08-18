import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { viewingSessions } from '../db/schema/index.js'

export async function openSession(opts: {
  profileId: string
  mediaType: string
  mediaId: string
  episodeId?: string | null
  startPositionMs?: number
  deviceType?: string | null
  clientType?: string | null
  sourceId?: string | null
  availabilityId?: string | null
}): Promise<string> {
  const [session] = await db
    .insert(viewingSessions)
    .values({
      profileId: opts.profileId,
      mediaType: opts.mediaType,
      mediaId: opts.mediaId,
      episodeId: opts.episodeId ?? null,
      startPositionMs: opts.startPositionMs ?? 0,
      maxPositionMs: opts.startPositionMs ?? 0,
      deviceType: opts.deviceType ?? null,
      clientType: opts.clientType ?? null,
      sourceId: opts.sourceId ?? null,
      availabilityId: opts.availabilityId ?? null,
    })
    .returning({ id: viewingSessions.id })
  return session.id
}

export async function updateSession(
  sessionId: string,
  opts: {
    endPositionMs?: number
    maxPositionMs?: number
    watchedMsApprox?: number
  },
): Promise<void> {
  await db
    .update(viewingSessions)
    .set({
      endPositionMs: opts.endPositionMs ?? undefined,
      maxPositionMs: opts.maxPositionMs ?? undefined,
      watchedMsApprox: opts.watchedMsApprox ?? undefined,
    })
    .where(eq(viewingSessions.id, sessionId))
}

export async function closeSession(sessionId: string, completed: boolean): Promise<void> {
  await db
    .update(viewingSessions)
    .set({ endedAt: new Date(), completed })
    .where(eq(viewingSessions.id, sessionId))
}

export async function getActiveSession(
  profileId: string,
  mediaId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: viewingSessions.id })
    .from(viewingSessions)
    .where(
      and(
        eq(viewingSessions.profileId, profileId),
        eq(viewingSessions.mediaId, mediaId),
        isNull(viewingSessions.endedAt),
      ),
    )
  return row ?? null
}
