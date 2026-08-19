import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mediaArrivals } from '../db/schema/arrivals.js';
import { followRelease } from '../db/schema/release-lifecycle.js';
import { sources } from '../db/schema/sources.js';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { NotFoundError } from '../errors.js';
export async function recordArrivalsForFollowers(mediaType, mediaId, sourceId, releaseEventId, arrivedAt) {
    const followers = await db
        .select({ profileId: followRelease.profileId })
        .from(followRelease)
        .where(and(eq(followRelease.mediaType, mediaType), eq(followRelease.mediaId, mediaId)));
    if (followers.length === 0)
        return;
    await db
        .insert(mediaArrivals)
        .values(followers.map((f) => ({
        profileId: f.profileId,
        mediaType,
        mediaId,
        sourceId: sourceId ?? null,
        releaseEventId,
        arrivedAt,
    })))
        .onConflictDoNothing();
}
export async function listArrivals(profileId, filter = 'unread') {
    const whereClause = filter === 'unread'
        ? and(eq(mediaArrivals.profileId, profileId), isNull(mediaArrivals.readAt))
        : eq(mediaArrivals.profileId, profileId);
    const rows = await db
        .select()
        .from(mediaArrivals)
        .where(whereClause)
        .orderBy(desc(mediaArrivals.arrivedAt));
    if (rows.length === 0)
        return [];
    const movieIds = [...new Set(rows.filter((r) => r.mediaType === 'MOVIE').map((r) => r.mediaId))];
    const seriesIds = [...new Set(rows.filter((r) => r.mediaType === 'SERIES').map((r) => r.mediaId))];
    const srcIds = [...new Set(rows.map((r) => r.sourceId).filter((id) => id !== null))];
    const [movieRows, seriesRows, sourceRows] = await Promise.all([
        movieIds.length > 0
            ? db.select({ id: movies.id, title: movies.title }).from(movies).where(inArray(movies.id, movieIds))
            : Promise.resolve([]),
        seriesIds.length > 0
            ? db.select({ id: series.id, title: series.title }).from(series).where(inArray(series.id, seriesIds))
            : Promise.resolve([]),
        srcIds.length > 0
            ? db.select({ id: sources.id, name: sources.name }).from(sources).where(inArray(sources.id, srcIds))
            : Promise.resolve([]),
    ]);
    const movieTitles = Object.fromEntries(movieRows.map((m) => [m.id, m.title]));
    const seriesTitles = Object.fromEntries(seriesRows.map((s) => [s.id, s.title]));
    const sourceNames = Object.fromEntries(sourceRows.map((s) => [s.id, s.name]));
    return rows.map((row) => ({
        id: row.id,
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        mediaTitle: (row.mediaType === 'MOVIE' ? movieTitles[row.mediaId] : seriesTitles[row.mediaId]) ?? 'Unknown',
        sourceName: row.sourceId ? (sourceNames[row.sourceId] ?? null) : null,
        arrivedAt: row.arrivedAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
    }));
}
export async function markRead(profileId, arrivalId) {
    const [row] = await db
        .select({ id: mediaArrivals.id })
        .from(mediaArrivals)
        .where(and(eq(mediaArrivals.id, arrivalId), eq(mediaArrivals.profileId, profileId)));
    if (!row)
        throw new NotFoundError('Arrival', arrivalId);
    await db.update(mediaArrivals).set({ readAt: new Date() }).where(eq(mediaArrivals.id, arrivalId));
}
//# sourceMappingURL=arrival-service.js.map