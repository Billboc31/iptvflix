import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { seasons } from '../db/schema/seasons.js';
import { episodes } from '../db/schema/episodes.js';
import { movieAvailabilities, seriesAvailabilities, episodeAvailabilities, } from '../db/schema/availabilities.js';
import { syncRuns } from '../db/schema/sync-runs.js';
import { releaseEvents } from '../db/schema/release-lifecycle.js';
import { normalizeTitle } from '../matching/title-normalizer.js';
export class SyncAlreadyRunningError extends Error {
    constructor(sourceId) {
        super(`Sync already running for source ${sourceId}`);
        this.name = 'SyncAlreadyRunningError';
    }
}
const STALE_LOCK_MS = 10 * 60 * 1000;
/** Postgres `integer` / Drizzle `integer()` range (signed int4). */
const PG_INT4_MAX = 2_147_483_647;
/**
 * Parse a provider "tmdb" field into a storable id.
 * Xtream often sends garbage (stream ids, etc.) larger than int4 — reject those
 * so sync does not die with `integer out of range` on `movies.tmdb_id`.
 */
function parseTmdbId(tmdb) {
    if (!tmdb)
        return null;
    const n = parseInt(tmdb, 10);
    if (Number.isNaN(n) || n <= 0 || n > PG_INT4_MAX)
        return null;
    return n;
}
function parseYear(dateStr) {
    if (!dateStr || dateStr.length < 4)
        return null;
    const n = parseInt(dateStr.substring(0, 4), 10);
    return isNaN(n) ? null : n;
}
function isUniqueConstraintViolation(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const code = err.code ??
        err.cause?.code;
    return code === '23505';
}
function extractPlexTmdbId(guids) {
    const found = guids?.find((g) => g.id.startsWith('tmdb://'));
    return found ? found.id.slice('tmdb://'.length) : undefined;
}
async function resolveMovieId(tx, item) {
    const tmdbId = parseTmdbId(item.tmdb);
    if (tmdbId != null) {
        const [existingByTmdb] = await tx
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.tmdbId, tmdbId))
            .limit(1);
        if (existingByTmdb)
            return existingByTmdb.id;
        const inserted = await tx
            .insert(movies)
            .values({
            title: item.title,
            posterPath: item.posterPath ?? null,
            synopsis: item.synopsis ?? null,
            year: null,
            tmdbId,
        })
            .onConflictDoNothing({ target: movies.tmdbId })
            .returning({ id: movies.id });
        if (inserted[0])
            return inserted[0].id;
        const [row] = await tx
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.tmdbId, tmdbId))
            .limit(1);
        if (row)
            return row.id;
        throw new Error(`Failed to resolve movie for tmdbId=${tmdbId}`);
    }
    const [inserted] = await tx
        .insert(movies)
        .values({
        title: item.title,
        posterPath: item.posterPath ?? null,
        synopsis: item.synopsis ?? null,
        year: null,
        tmdbId: null,
    })
        .returning({ id: movies.id });
    return inserted.id;
}
async function resolveSeriesId(tx, item) {
    const tmdbId = parseTmdbId(item.tmdb);
    if (tmdbId != null) {
        const [existingByTmdb] = await tx
            .select({ id: series.id })
            .from(series)
            .where(eq(series.tmdbId, tmdbId))
            .limit(1);
        if (existingByTmdb)
            return existingByTmdb.id;
        const inserted = await tx
            .insert(series)
            .values({
            title: item.title,
            posterPath: item.posterPath ?? null,
            synopsis: item.synopsis ?? null,
            firstAirYear: item.firstAirYear ?? null,
            tmdbId,
        })
            .onConflictDoNothing({ target: series.tmdbId })
            .returning({ id: series.id });
        if (inserted[0])
            return inserted[0].id;
        const [row] = await tx
            .select({ id: series.id })
            .from(series)
            .where(eq(series.tmdbId, tmdbId))
            .limit(1);
        if (row)
            return row.id;
        throw new Error(`Failed to resolve series for tmdbId=${tmdbId}`);
    }
    const [inserted] = await tx
        .insert(series)
        .values({
        title: item.title,
        posterPath: item.posterPath ?? null,
        synopsis: item.synopsis ?? null,
        firstAirYear: item.firstAirYear ?? null,
        tmdbId: null,
    })
        .returning({ id: series.id });
    return inserted.id;
}
async function resolveEpisodeId(tx, seriesId, seasonNumber, episodeNumber) {
    let seasonId;
    const [existingSeason] = await tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.seriesId, seriesId), eq(seasons.seasonNumber, seasonNumber)))
        .limit(1);
    if (existingSeason) {
        seasonId = existingSeason.id;
    }
    else {
        const inserted = await tx
            .insert(seasons)
            .values({ seriesId, seasonNumber })
            .onConflictDoNothing()
            .returning({ id: seasons.id });
        if (inserted[0]) {
            seasonId = inserted[0].id;
        }
        else {
            const [row] = await tx
                .select({ id: seasons.id })
                .from(seasons)
                .where(and(eq(seasons.seriesId, seriesId), eq(seasons.seasonNumber, seasonNumber)))
                .limit(1);
            if (!row)
                throw new Error(`Failed to resolve season seriesId=${seriesId} season=${seasonNumber}`);
            seasonId = row.id;
        }
    }
    const [existingEpisode] = await tx
        .select({ id: episodes.id })
        .from(episodes)
        .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)))
        .limit(1);
    if (existingEpisode)
        return existingEpisode.id;
    const insertedEp = await tx
        .insert(episodes)
        .values({ seasonId, seriesId, episodeNumber })
        .onConflictDoNothing()
        .returning({ id: episodes.id });
    if (insertedEp[0])
        return insertedEp[0].id;
    const [row] = await tx
        .select({ id: episodes.id })
        .from(episodes)
        .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)))
        .limit(1);
    if (!row)
        throw new Error(`Failed to resolve episode seasonId=${seasonId} episode=${episodeNumber}`);
    return row.id;
}
async function syncNormalized(sourceId, snapshot) {
    // Clear any stale RUNNING lock for this source
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MS);
    await db
        .update(syncRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage: 'stale lock cleared' })
        .where(and(eq(syncRuns.sourceId, sourceId), eq(syncRuns.status, 'RUNNING'), lt(syncRuns.startedAt, staleThreshold)));
    // Acquire lock by inserting a RUNNING run record
    let runId;
    try {
        const [run] = await db
            .insert(syncRuns)
            .values({ sourceId, status: 'RUNNING' })
            .returning();
        runId = run.id;
    }
    catch (err) {
        if (isUniqueConstraintViolation(err)) {
            throw new SyncAlreadyRunningError(sourceId);
        }
        throw err;
    }
    const counts = {
        moviesCreated: 0,
        moviesUpdated: 0,
        seriesCreated: 0,
        seriesUpdated: 0,
        unavailableCount: 0,
        failedCount: snapshot.failedSeriesProviderIds?.length ?? 0,
    };
    let syncError;
    try {
        await db.transaction(async (tx) => {
            // Collect currently AVAILABLE items for this source before sync
            const prevMovieRows = await tx
                .select({ providerItemId: movieAvailabilities.providerItemId })
                .from(movieAvailabilities)
                .where(and(eq(movieAvailabilities.providerId, sourceId), eq(movieAvailabilities.status, 'AVAILABLE')));
            const previouslyAvailableMovieIds = new Set(prevMovieRows.map((r) => r.providerItemId));
            const prevSeriesRows = await tx
                .select({ providerItemId: seriesAvailabilities.providerItemId })
                .from(seriesAvailabilities)
                .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.status, 'AVAILABLE')));
            const previouslyAvailableSeriesIds = new Set(prevSeriesRows.map((r) => r.providerItemId));
            // Sync movies
            const seenMovieProviderItemIds = new Set();
            for (const movie of snapshot.movies) {
                const providerItemId = movie.providerItemId;
                const [existing] = await tx
                    .select({ id: movieAvailabilities.id, movieId: movieAvailabilities.movieId, status: movieAvailabilities.status })
                    .from(movieAvailabilities)
                    .where(and(eq(movieAvailabilities.providerId, sourceId), eq(movieAvailabilities.providerItemId, providerItemId)));
                if (!existing) {
                    const movieId = await resolveMovieId(tx, movie);
                    await tx.insert(movieAvailabilities).values({
                        movieId,
                        providerId: sourceId,
                        providerItemId,
                        firstSeenAt: snapshot.fetchedAt,
                        lastSeenAt: snapshot.fetchedAt,
                        status: 'AVAILABLE',
                        rawTitle: movie.rawTitle ?? null,
                        audioLanguage: movie.audioLanguage ?? null,
                        subtitleLanguage: movie.subtitleLanguage ?? null,
                        videoQuality: movie.videoQuality ?? null,
                    });
                    await tx
                        .insert(releaseEvents)
                        .values({ mediaType: 'MOVIE', mediaId: movieId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                        .onConflictDoNothing();
                    counts.moviesCreated++;
                }
                else {
                    const wasUnavailable = existing.status === 'UNAVAILABLE';
                    await tx
                        .update(movieAvailabilities)
                        .set({
                        lastSeenAt: snapshot.fetchedAt,
                        status: 'AVAILABLE',
                        unavailableAt: null,
                        rawTitle: movie.rawTitle ?? null,
                        audioLanguage: movie.audioLanguage ?? null,
                        subtitleLanguage: movie.subtitleLanguage ?? null,
                        videoQuality: movie.videoQuality ?? null,
                    })
                        .where(and(eq(movieAvailabilities.providerId, sourceId), eq(movieAvailabilities.providerItemId, providerItemId)));
                    if (wasUnavailable) {
                        await tx
                            .insert(releaseEvents)
                            .values({ mediaType: 'MOVIE', mediaId: existing.movieId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                            .onConflictDoNothing();
                    }
                    counts.moviesUpdated++;
                }
                seenMovieProviderItemIds.add(providerItemId);
            }
            // Sync series
            const seenSeriesProviderItemIds = new Set();
            for (const s of snapshot.series) {
                const providerItemId = s.providerItemId;
                const [existing] = await tx
                    .select({ id: seriesAvailabilities.id, seriesId: seriesAvailabilities.seriesId, status: seriesAvailabilities.status })
                    .from(seriesAvailabilities)
                    .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.providerItemId, providerItemId)));
                if (!existing) {
                    const seriesId = await resolveSeriesId(tx, s);
                    await tx.insert(seriesAvailabilities).values({
                        seriesId,
                        providerId: sourceId,
                        providerItemId,
                        firstSeenAt: snapshot.fetchedAt,
                        lastSeenAt: snapshot.fetchedAt,
                        status: 'AVAILABLE',
                        rawTitle: s.rawTitle ?? null,
                        audioLanguage: s.audioLanguage ?? null,
                        subtitleLanguage: s.subtitleLanguage ?? null,
                        videoQuality: s.videoQuality ?? null,
                    });
                    await tx
                        .insert(releaseEvents)
                        .values({ mediaType: 'SERIES', mediaId: seriesId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                        .onConflictDoNothing();
                    counts.seriesCreated++;
                }
                else {
                    const wasUnavailable = existing.status === 'UNAVAILABLE';
                    await tx
                        .update(seriesAvailabilities)
                        .set({
                        lastSeenAt: snapshot.fetchedAt,
                        status: 'AVAILABLE',
                        unavailableAt: null,
                        rawTitle: s.rawTitle ?? null,
                        audioLanguage: s.audioLanguage ?? null,
                        subtitleLanguage: s.subtitleLanguage ?? null,
                        videoQuality: s.videoQuality ?? null,
                    })
                        .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.providerItemId, providerItemId)));
                    if (wasUnavailable) {
                        await tx
                            .insert(releaseEvents)
                            .values({ mediaType: 'SERIES', mediaId: existing.seriesId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                            .onConflictDoNothing();
                    }
                    counts.seriesUpdated++;
                }
                seenSeriesProviderItemIds.add(providerItemId);
            }
            // Mark previously available items not in this snapshot as UNAVAILABLE
            const missingMovieIds = [...previouslyAvailableMovieIds].filter((id) => !seenMovieProviderItemIds.has(id));
            if (missingMovieIds.length > 0) {
                const disappearedMovies = await tx
                    .update(movieAvailabilities)
                    .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
                    .where(and(eq(movieAvailabilities.providerId, sourceId), eq(movieAvailabilities.status, 'AVAILABLE'), inArray(movieAvailabilities.providerItemId, missingMovieIds)))
                    .returning({ movieId: movieAvailabilities.movieId });
                for (const { movieId } of disappearedMovies) {
                    await tx
                        .insert(releaseEvents)
                        .values({ mediaType: 'MOVIE', mediaId: movieId, eventType: 'SOURCE_DISAPPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                        .onConflictDoNothing();
                }
                counts.unavailableCount += missingMovieIds.length;
            }
            const missingSeriesIds = [...previouslyAvailableSeriesIds].filter((id) => !seenSeriesProviderItemIds.has(id));
            if (missingSeriesIds.length > 0) {
                const disappearedSeries = await tx
                    .update(seriesAvailabilities)
                    .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
                    .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.status, 'AVAILABLE'), inArray(seriesAvailabilities.providerItemId, missingSeriesIds)))
                    .returning({ seriesId: seriesAvailabilities.seriesId });
                for (const { seriesId } of disappearedSeries) {
                    await tx
                        .insert(releaseEvents)
                        .values({ mediaType: 'SERIES', mediaId: seriesId, eventType: 'SOURCE_DISAPPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                        .onConflictDoNothing();
                }
                counts.unavailableCount += missingSeriesIds.length;
            }
            // Episode availability lifecycle — only runs when snapshot carries authoritative episode data.
            // When snapshot.episodes is undefined, existing episode availabilities are left untouched.
            if (snapshot.episodes !== undefined) {
                const prevEpisodeRows = await tx
                    .select({ providerItemId: episodeAvailabilities.providerItemId })
                    .from(episodeAvailabilities)
                    .where(and(eq(episodeAvailabilities.providerId, sourceId), eq(episodeAvailabilities.status, 'AVAILABLE')));
                const previouslyAvailableEpisodeIds = new Set(prevEpisodeRows.map((r) => r.providerItemId));
                const seenEpisodeProviderItemIds = new Set();
                for (const ep of snapshot.episodes) {
                    const [seriesAv] = await tx
                        .select({ seriesId: seriesAvailabilities.seriesId })
                        .from(seriesAvailabilities)
                        .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.providerItemId, ep.seriesProviderItemId)))
                        .limit(1);
                    if (!seriesAv)
                        continue;
                    const episodeId = await resolveEpisodeId(tx, seriesAv.seriesId, ep.seasonNumber, ep.episodeNumber);
                    const [existing] = await tx
                        .select({ id: episodeAvailabilities.id, episodeId: episodeAvailabilities.episodeId, status: episodeAvailabilities.status })
                        .from(episodeAvailabilities)
                        .where(and(eq(episodeAvailabilities.providerId, sourceId), eq(episodeAvailabilities.providerItemId, ep.providerItemId)))
                        .limit(1);
                    if (!existing) {
                        await tx.insert(episodeAvailabilities).values({
                            episodeId,
                            providerId: sourceId,
                            providerItemId: ep.providerItemId,
                            firstSeenAt: snapshot.fetchedAt,
                            lastSeenAt: snapshot.fetchedAt,
                            status: 'AVAILABLE',
                        });
                        await tx
                            .insert(releaseEvents)
                            .values({ mediaType: 'EPISODE', mediaId: episodeId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                            .onConflictDoNothing();
                    }
                    else if (existing.episodeId !== episodeId) {
                        console.warn(`[catalog-sync] provider item ${sourceId}/${ep.providerItemId} already assigned to episode ${existing.episodeId}, skipping reassignment to ${episodeId}`);
                        seenEpisodeProviderItemIds.add(ep.providerItemId);
                        continue;
                    }
                    else {
                        const wasUnavailable = existing.status === 'UNAVAILABLE';
                        await tx
                            .update(episodeAvailabilities)
                            .set({ lastSeenAt: snapshot.fetchedAt, status: 'AVAILABLE', unavailableAt: null })
                            .where(eq(episodeAvailabilities.id, existing.id));
                        if (wasUnavailable) {
                            await tx
                                .insert(releaseEvents)
                                .values({ mediaType: 'EPISODE', mediaId: episodeId, eventType: 'SOURCE_APPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                                .onConflictDoNothing();
                        }
                    }
                    seenEpisodeProviderItemIds.add(ep.providerItemId);
                }
                const protectedEpisodeIds = new Set();
                const failedProviderIds = snapshot.failedSeriesProviderIds;
                if (failedProviderIds && failedProviderIds.length > 0) {
                    const protectedRows = await tx
                        .select({ providerItemId: episodeAvailabilities.providerItemId })
                        .from(episodeAvailabilities)
                        .innerJoin(episodes, eq(episodeAvailabilities.episodeId, episodes.id))
                        .innerJoin(seriesAvailabilities, and(eq(episodes.seriesId, seriesAvailabilities.seriesId), eq(seriesAvailabilities.providerId, sourceId), inArray(seriesAvailabilities.providerItemId, failedProviderIds)))
                        .where(and(eq(episodeAvailabilities.providerId, sourceId), eq(episodeAvailabilities.status, 'AVAILABLE')));
                    for (const row of protectedRows) {
                        protectedEpisodeIds.add(row.providerItemId);
                    }
                }
                const missingEpisodeIds = [...previouslyAvailableEpisodeIds].filter((id) => !seenEpisodeProviderItemIds.has(id) && !protectedEpisodeIds.has(id));
                if (missingEpisodeIds.length > 0) {
                    const disappearedEpisodes = await tx
                        .update(episodeAvailabilities)
                        .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
                        .where(and(eq(episodeAvailabilities.providerId, sourceId), eq(episodeAvailabilities.status, 'AVAILABLE'), inArray(episodeAvailabilities.providerItemId, missingEpisodeIds)))
                        .returning({ episodeId: episodeAvailabilities.episodeId });
                    for (const { episodeId } of disappearedEpisodes) {
                        await tx
                            .insert(releaseEvents)
                            .values({ mediaType: 'EPISODE', mediaId: episodeId, eventType: 'SOURCE_DISAPPEARED', occurredAt: snapshot.fetchedAt, sourceId })
                            .onConflictDoNothing();
                    }
                    counts.unavailableCount += missingEpisodeIds.length;
                }
            }
        });
    }
    catch (err) {
        syncError = err instanceof Error ? err : new Error(String(err));
    }
    // Release lock — always runs regardless of sync outcome
    if (syncError) {
        await db
            .update(syncRuns)
            .set({ status: 'FAILED', completedAt: new Date(), errorMessage: syncError.message })
            .where(eq(syncRuns.id, runId));
        return { runId, status: 'failed', counts, error: syncError.message };
    }
    await db
        .update(syncRuns)
        .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        moviesCreated: counts.moviesCreated,
        moviesUpdated: counts.moviesUpdated,
        seriesCreated: counts.seriesCreated,
        seriesUpdated: counts.seriesUpdated,
        unavailableCount: counts.unavailableCount,
        failedCount: counts.failedCount,
    })
        .where(eq(syncRuns.id, runId));
    return { runId, status: 'completed', counts };
}
export const CatalogSyncService = {
    async syncCatalog(sourceId, snapshot) {
        const normalizedEpisodes = snapshot.seriesInfo
            ? Object.entries(snapshot.seriesInfo).flatMap(([seriesIdStr, info]) => Object.entries(info.episodes).flatMap(([seasonKey, episodeList]) => {
                const seasonNumber = parseInt(seasonKey, 10);
                return episodeList.map((ep) => ({
                    providerItemId: ep.id,
                    seriesProviderItemId: seriesIdStr,
                    seasonNumber,
                    episodeNumber: ep.episode_num,
                    title: ep.title ?? null,
                    durationMinutes: ep.info.duration_secs
                        ? Math.round(ep.info.duration_secs / 60)
                        : null,
                    airDate: ep.info.releasedate ?? null,
                }));
            }))
            : undefined;
        return syncNormalized(sourceId, {
            sourceId: snapshot.sourceId,
            fetchedAt: snapshot.fetchedAt,
            movies: snapshot.vodStreams.map((s) => {
                const { variantAttributes } = normalizeTitle(s.name);
                return {
                    providerItemId: s.stream_id.toString(),
                    title: s.name,
                    posterPath: s.cover,
                    synopsis: s.plot ?? s.description,
                    tmdb: s.tmdb,
                    rawTitle: s.name,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                };
            }),
            series: snapshot.series.map((s) => {
                const { variantAttributes } = normalizeTitle(s.name);
                return {
                    providerItemId: s.series_id.toString(),
                    title: s.name,
                    posterPath: s.cover,
                    synopsis: s.plot,
                    tmdb: snapshot.seriesInfo?.[s.series_id]?.info.tmdb_id,
                    firstAirYear: parseYear(s.releaseDate),
                    rawTitle: s.name,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                };
            }),
            episodes: normalizedEpisodes,
            failedSeriesProviderIds: snapshot.failedSeriesIds?.map(String),
        });
    },
    async syncPlexCatalog(sourceId, snapshot) {
        return syncNormalized(sourceId, {
            sourceId: snapshot.sourceId,
            fetchedAt: snapshot.fetchedAt,
            movies: snapshot.movies.map((m) => ({
                providerItemId: m.ratingKey,
                title: m.title,
                posterPath: m.thumb,
                synopsis: m.summary,
                tmdb: extractPlexTmdbId(m.Guid),
            })),
            series: snapshot.shows.map((s) => ({
                providerItemId: s.ratingKey,
                title: s.title,
                posterPath: s.thumb,
                synopsis: s.summary,
                tmdb: extractPlexTmdbId(s.Guid),
                firstAirYear: s.year ?? null,
            })),
            episodes: snapshot.episodes.map((ep) => ({
                providerItemId: ep.ratingKey,
                seriesProviderItemId: ep.grandparentRatingKey,
                seasonNumber: ep.parentIndex,
                episodeNumber: ep.index,
                title: ep.title,
                synopsis: ep.summary ?? null,
                durationMinutes: ep.duration ? Math.round(ep.duration / 60000) : null,
                airDate: ep.originallyAvailableAt ?? null,
            })),
        });
    },
};
//# sourceMappingURL=catalog-sync-service.js.map