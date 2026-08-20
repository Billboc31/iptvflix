import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { viewingSessions } from '../db/schema/index.js';
export async function openSession(opts) {
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
        .returning({ id: viewingSessions.id });
    return session.id;
}
export async function updateSession(sessionId, opts) {
    await db
        .update(viewingSessions)
        .set({
        endPositionMs: opts.endPositionMs ?? undefined,
        maxPositionMs: opts.maxPositionMs ?? undefined,
        watchedMsApprox: opts.watchedMsApprox ?? undefined,
    })
        .where(eq(viewingSessions.id, sessionId));
}
export async function closeSession(sessionId, completed) {
    await db
        .update(viewingSessions)
        .set({ endedAt: new Date(), completed })
        .where(eq(viewingSessions.id, sessionId));
}
export async function getActiveSession(profileId, mediaId) {
    const [row] = await db
        .select({ id: viewingSessions.id })
        .from(viewingSessions)
        .where(and(eq(viewingSessions.profileId, profileId), eq(viewingSessions.mediaId, mediaId), isNull(viewingSessions.endedAt)));
    return row ?? null;
}
//# sourceMappingURL=viewing-session-service.js.map