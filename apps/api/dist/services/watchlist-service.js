import { resolveMediaImageUrl } from '../lib/tmdb-image.js';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { watchlist, movies, series } from '../db/schema/index.js';
import { NotFoundError } from '../errors.js';
async function fetchMediaMeta(mediaType, mediaId) {
    if (mediaType === 'MOVIE') {
        const [row] = await db
            .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
            .from(movies)
            .where(eq(movies.id, mediaId));
        if (!row)
            throw new NotFoundError('Movie', mediaId);
        return { title: row.title, posterUrl: resolveMediaImageUrl(row.posterPath) };
    }
    else {
        const [row] = await db
            .select({ id: series.id, title: series.title, posterPath: series.posterPath })
            .from(series)
            .where(eq(series.id, mediaId));
        if (!row)
            throw new NotFoundError('Series', mediaId);
        return { title: row.title, posterUrl: resolveMediaImageUrl(row.posterPath) };
    }
}
function toEntry(row, title, posterUrl) {
    return {
        id: row.id,
        profileId: row.profileId,
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        title,
        posterUrl,
        addedAt: row.addedAt.toISOString(),
    };
}
export async function addToWatchlist(profileId, mediaType, mediaId) {
    const meta = await fetchMediaMeta(mediaType, mediaId);
    const [row] = await db
        .insert(watchlist)
        .values({ profileId, mediaType, mediaId })
        .onConflictDoNothing()
        .returning();
    if (!row) {
        const [existing] = await db
            .select()
            .from(watchlist)
            .where(and(eq(watchlist.profileId, profileId), eq(watchlist.mediaType, mediaType), eq(watchlist.mediaId, mediaId)));
        return toEntry(existing, meta.title, meta.posterUrl);
    }
    return toEntry(row, meta.title, meta.posterUrl);
}
export async function removeFromWatchlist(profileId, mediaType, mediaId) {
    await db
        .delete(watchlist)
        .where(and(eq(watchlist.profileId, profileId), eq(watchlist.mediaType, mediaType), eq(watchlist.mediaId, mediaId)));
}
export async function listWatchlist(profileId) {
    const rows = await db
        .select()
        .from(watchlist)
        .where(eq(watchlist.profileId, profileId))
        .orderBy(desc(watchlist.addedAt));
    if (rows.length === 0)
        return [];
    const movieIds = rows.filter((r) => r.mediaType === 'MOVIE').map((r) => r.mediaId);
    const seriesIds = rows.filter((r) => r.mediaType === 'SERIES').map((r) => r.mediaId);
    const [movieRows, seriesRows] = await Promise.all([
        movieIds.length > 0
            ? db
                .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
                .from(movies)
                .where(inArray(movies.id, movieIds))
            : Promise.resolve([]),
        seriesIds.length > 0
            ? db
                .select({ id: series.id, title: series.title, posterPath: series.posterPath })
                .from(series)
                .where(inArray(series.id, seriesIds))
            : Promise.resolve([]),
    ]);
    const movieMap = new Map(movieRows.map((m) => [m.id, m]));
    const seriesMap = new Map(seriesRows.map((s) => [s.id, s]));
    return rows.map((row) => {
        const meta = row.mediaType === 'MOVIE' ? movieMap.get(row.mediaId) : seriesMap.get(row.mediaId);
        return toEntry(row, meta?.title ?? row.mediaId, resolveMediaImageUrl(meta?.posterPath));
    });
}
//# sourceMappingURL=watchlist-service.js.map