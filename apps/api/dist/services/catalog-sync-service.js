import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { seasons } from '../db/schema/seasons.js';
import { episodes } from '../db/schema/episodes.js';
import { movieAvailabilities, seriesAvailabilities, episodeAvailabilities, } from '../db/schema/availabilities.js';
import { syncRuns } from '../db/schema/sync-runs.js';
import { titleMatchResults } from '../db/schema/title-match-results.js';
import { releaseEvents } from '../db/schema/release-lifecycle.js';
import { normalizeTitle } from '../matching/title-normalizer.js';
const MATCH_CONCURRENCY = parseInt(process.env.MATCH_CONCURRENCY ?? '5', 10) || 5;
const MATCH_THROTTLE_MS = parseInt(process.env.MATCH_THROTTLE_MS ?? '250', 10) || 0;
export class SyncAlreadyRunningError extends Error {
    constructor(sourceId) {
        super(`Sync already running for source ${sourceId}`);
        this.name = 'SyncAlreadyRunningError';
    }
}
const STALE_LOCK_MS = 2 * 60 * 60 * 1000; // large Xtream catalogs can run for a long time
/** Items committed per DB transaction — keeps progress visible and avoids multi-hour locks. */
const SYNC_CHUNK_SIZE = Math.max(50, parseInt(process.env.SYNC_CHUNK_SIZE ?? '500', 10) || 500);
function isUniqueConstraintViolation(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const code = err.code ??
        err.cause?.code;
    return code === '23505';
}
/** Strip NULs / control junk Xtream sometimes embeds; Postgres rejects `\0` in text. */
function sanitizeText(value) {
    if (value == null)
        return null;
    const cleaned = String(value).replace(/\u0000/g, '').trim();
    return cleaned.length > 0 ? cleaned : null;
}
function localTitleDedupeKey(raw) {
    const { normalizedTitle, extractedYear } = normalizeTitle(raw);
    return `${normalizedTitle}::${extractedYear ?? ''}`;
}
/** Drizzle wraps pg errors; surface the underlying cause in sync_runs.error_message. */
function formatDbError(err) {
    const parts = [];
    let cur = err;
    for (let depth = 0; depth < 5 && cur; depth++) {
        if (!(cur instanceof Error)) {
            parts.push(String(cur));
            break;
        }
        const e = cur;
        if (e.code)
            parts.push(`code=${e.code}`);
        if (e.constraint)
            parts.push(`constraint=${e.constraint}`);
        if (e.detail)
            parts.push(e.detail);
        if (e.message) {
            parts.push(e.message.startsWith('Failed query:')
                ? `${e.message.slice(0, 160)}…`
                : e.message);
        }
        cur = e.cause;
    }
    const combined = parts.filter(Boolean).join(' | ');
    return (combined || String(err)).slice(0, 2000);
}
/** Clear stale RUNNING locks and insert a new RUNNING sync_run. */
export async function acquireSyncRunLock(sourceId) {
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MS);
    await db
        .update(syncRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage: 'stale lock cleared' })
        .where(and(eq(syncRuns.sourceId, sourceId), eq(syncRuns.status, 'RUNNING'), lt(syncRuns.startedAt, staleThreshold)));
    try {
        const [run] = await db
            .insert(syncRuns)
            .values({ sourceId, status: 'RUNNING' })
            .returning();
        return run.id;
    }
    catch (err) {
        if (isUniqueConstraintViolation(err)) {
            throw new SyncAlreadyRunningError(sourceId);
        }
        throw err;
    }
}
export async function failSyncRun(runId, errorMessage) {
    await db
        .update(syncRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage })
        .where(eq(syncRuns.id, runId));
}
/** Stores a human-readable phase in error_message while the run is still RUNNING. */
export async function setSyncRunProgress(runId, progress) {
    await db
        .update(syncRuns)
        .set({ errorMessage: progress.slice(0, 500) })
        .where(and(eq(syncRuns.id, runId), eq(syncRuns.status, 'RUNNING')));
}
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
function extractPlexTmdbId(guids) {
    const found = guids?.find((g) => g.id.startsWith('tmdb://'));
    return found ? found.id.slice('tmdb://'.length) : undefined;
}
/**
 * Ensures a canonical movie exists for the given TMDB ID without using any provider
 * metadata. Creates a placeholder title when the movie is absent locally; enrichment
 * overwrites it with real TMDB data on its next run.
 */
async function importMovieFallback(tmdbId, tmdbCache) {
    const cached = tmdbCache.get(tmdbId);
    if (cached)
        return { id: cached };
    const [existing] = await db
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId))
        .limit(1);
    if (existing) {
        tmdbCache.set(tmdbId, existing.id);
        return existing;
    }
    const [inserted] = await db
        .insert(movies)
        .values({ title: `[TMDB #${tmdbId}]`, tmdbId, matchStatus: 'MATCHED' })
        .onConflictDoNothing({ target: movies.tmdbId })
        .returning({ id: movies.id });
    if (inserted) {
        tmdbCache.set(tmdbId, inserted.id);
        return inserted;
    }
    const [row] = await db
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId))
        .limit(1);
    if (row)
        tmdbCache.set(tmdbId, row.id);
    return row ?? null;
}
/** Same as importMovieFallback but for series. */
async function importSeriesFallback(tmdbId, tmdbCache) {
    const cached = tmdbCache.get(tmdbId);
    if (cached)
        return { id: cached };
    const [existing] = await db
        .select({ id: series.id })
        .from(series)
        .where(eq(series.tmdbId, tmdbId))
        .limit(1);
    if (existing) {
        tmdbCache.set(tmdbId, existing.id);
        return existing;
    }
    const [inserted] = await db
        .insert(series)
        .values({ title: `[TMDB #${tmdbId}]`, tmdbId, matchStatus: 'MATCHED' })
        .onConflictDoNothing({ target: series.tmdbId })
        .returning({ id: series.id });
    if (inserted) {
        tmdbCache.set(tmdbId, inserted.id);
        return inserted;
    }
    const [row] = await db
        .select({ id: series.id })
        .from(series)
        .where(eq(series.tmdbId, tmdbId))
        .limit(1);
    if (row)
        tmdbCache.set(tmdbId, row.id);
    return row ?? null;
}
async function resolveEpisodeId(tx, seriesId, seasonNumber, episodeNumber, meta) {
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
    if (existingEpisode) {
        if (meta?.posterPath) {
            await tx
                .update(episodes)
                .set({ posterPath: meta.posterPath, updatedAt: new Date() })
                .where(and(eq(episodes.id, existingEpisode.id), isNull(episodes.posterPath)));
        }
        return existingEpisode.id;
    }
    const insertedEp = await tx
        .insert(episodes)
        .values({
        seasonId,
        seriesId,
        episodeNumber,
        title: meta?.title ?? null,
        synopsis: meta?.synopsis ?? null,
        durationMinutes: meta?.durationMinutes ?? null,
        airDate: meta?.airDate ?? null,
        posterPath: meta?.posterPath ?? null,
    })
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
async function persistSyncRunProgress(runId, counts) {
    await db
        .update(syncRuns)
        .set({
        moviesCreated: counts.moviesCreated,
        moviesUpdated: counts.moviesUpdated,
        seriesCreated: counts.seriesCreated,
        seriesUpdated: counts.seriesUpdated,
        unavailableCount: counts.unavailableCount,
        failedCount: counts.failedCount,
        titleMatchedCount: counts.titleMatchedCount,
        titleUnmatchedCount: counts.titleUnmatchedCount,
        resolvedCount: counts.resolvedCount,
        ambiguousCount: counts.ambiguousCount,
        unresolvedCount: counts.unresolvedCount,
    })
        .where(eq(syncRuns.id, runId));
}
async function runTitleMatchPrePass(sourceId, items, matchingService) {
    if (items.length === 0) {
        return { prePassMap: new Map(), matchStateMap: new Map(), matchedCount: 0, unmatchedCount: 0, ambiguousCount: 0 };
    }
    const mediaType = items[0].mediaType;
    // Guard: skip items already MATCHED in a previous sync run (same media type only —
    // Xtream movie stream_id and series_id often collide as the same string).
    const existingMatched = await db
        .select({
        providerItemId: titleMatchResults.providerItemId,
        movieId: titleMatchResults.movieId,
        seriesId: titleMatchResults.seriesId,
        mediaType: titleMatchResults.mediaType,
    })
        .from(titleMatchResults)
        .where(and(eq(titleMatchResults.providerId, sourceId), eq(titleMatchResults.matchState, 'MATCHED'), eq(titleMatchResults.mediaType, mediaType), inArray(titleMatchResults.providerItemId, items.map((i) => i.providerItemId))));
    const prePassMap = new Map();
    const matchStateMap = new Map();
    const alreadyMatchedIds = new Set();
    for (const row of existingMatched) {
        const canonicalId = mediaType === 'MOVIE' ? row.movieId ?? null : row.seriesId ?? null;
        prePassMap.set(row.providerItemId, canonicalId);
        alreadyMatchedIds.add(row.providerItemId);
    }
    // Deduplicate by (normalizedTitle, extractedYear) to avoid redundant TMDB calls
    const dedupeKey = (rawTitle) => {
        const { normalizedTitle, extractedYear } = normalizeTitle(rawTitle);
        return `${normalizedTitle}::${extractedYear ?? ''}`;
    };
    const dedupeMap = new Map(); // key → canonicalId (from first resolved item)
    const pendingItems = items.filter((i) => !alreadyMatchedIds.has(i.providerItemId));
    const inputs = pendingItems.map((i) => ({
        providerId: sourceId,
        providerItemId: i.providerItemId,
        rawTitle: i.rawTitle,
        mediaType: i.mediaType,
    }));
    let matchedCount = existingMatched.filter((r) => mediaType === 'MOVIE' ? r.movieId != null : r.seriesId != null).length;
    let unmatchedCount = 0;
    let ambiguousCount = 0;
    const results = await matchingService.matchBatch(inputs, {
        concurrency: MATCH_CONCURRENCY,
        throttleMs: MATCH_THROTTLE_MS,
    });
    for (let idx = 0; idx < results.length; idx++) {
        const result = results[idx];
        const item = pendingItems[idx];
        if (!item || !result)
            continue;
        const key = dedupeKey(item.rawTitle);
        if (result.matchState === 'MATCHED') {
            const canonicalId = mediaType === 'MOVIE' ? result.movieId ?? null : result.seriesId ?? null;
            prePassMap.set(item.providerItemId, canonicalId);
            if (canonicalId)
                dedupeMap.set(key, canonicalId);
            matchedCount++;
        }
        else {
            // Check dedupe — same normalized title already resolved this sync
            const deduped = dedupeMap.get(key);
            if (deduped) {
                prePassMap.set(item.providerItemId, deduped);
                matchedCount++;
            }
            else {
                prePassMap.set(item.providerItemId, null);
                if (result.matchState === 'AMBIGUOUS') {
                    matchStateMap.set(item.providerItemId, 'AMBIGUOUS');
                    ambiguousCount++;
                }
                else {
                    matchStateMap.set(item.providerItemId, 'UNMATCHED');
                    unmatchedCount++;
                }
            }
        }
    }
    return { prePassMap, matchStateMap, matchedCount, unmatchedCount, ambiguousCount };
}
async function syncNormalized(sourceId, snapshot, existingRunId, matchingService, canonicalResolver) {
    // Acquire lock by inserting a RUNNING run record (unless caller already did).
    let runId;
    if (existingRunId) {
        runId = existingRunId;
    }
    else {
        runId = await acquireSyncRunLock(sourceId);
    }
    const counts = {
        moviesCreated: 0,
        moviesUpdated: 0,
        seriesCreated: 0,
        seriesUpdated: 0,
        unavailableCount: 0,
        failedCount: snapshot.failedSeriesProviderIds?.length ?? 0,
        titleMatchedCount: 0,
        titleUnmatchedCount: 0,
        resolvedCount: 0,
        ambiguousCount: 0,
        unresolvedCount: 0,
    };
    let syncError;
    try {
        // Prefetch maps once — avoids 1 SELECT per catalog item on large Xtream syncs.
        const prevMovieRows = await db
            .select({
            id: movieAvailabilities.id,
            movieId: movieAvailabilities.movieId,
            providerItemId: movieAvailabilities.providerItemId,
            status: movieAvailabilities.status,
        })
            .from(movieAvailabilities)
            .where(eq(movieAvailabilities.providerId, sourceId));
        const movieAvByProviderItemId = new Map();
        const previouslyAvailableMovieIds = new Set();
        for (const row of prevMovieRows) {
            movieAvByProviderItemId.set(row.providerItemId, {
                id: row.id,
                movieId: row.movieId,
                status: row.status,
            });
            if (row.status === 'AVAILABLE')
                previouslyAvailableMovieIds.add(row.providerItemId);
        }
        const prevSeriesRows = await db
            .select({
            id: seriesAvailabilities.id,
            seriesId: seriesAvailabilities.seriesId,
            providerItemId: seriesAvailabilities.providerItemId,
            status: seriesAvailabilities.status,
        })
            .from(seriesAvailabilities)
            .where(eq(seriesAvailabilities.providerId, sourceId));
        const seriesAvByProviderItemId = new Map();
        const previouslyAvailableSeriesIds = new Set();
        for (const row of prevSeriesRows) {
            seriesAvByProviderItemId.set(row.providerItemId, {
                id: row.id,
                seriesId: row.seriesId,
                status: row.status,
            });
            if (row.status === 'AVAILABLE')
                previouslyAvailableSeriesIds.add(row.providerItemId);
        }
        const movieTmdbRows = await db
            .select({ id: movies.id, tmdbId: movies.tmdbId })
            .from(movies)
            .where(isNotNull(movies.tmdbId));
        const movieTmdbCache = new Map();
        for (const row of movieTmdbRows) {
            if (row.tmdbId != null)
                movieTmdbCache.set(row.tmdbId, row.id);
        }
        const seriesTmdbRows = await db
            .select({ id: series.id, tmdbId: series.tmdbId })
            .from(series)
            .where(isNotNull(series.tmdbId));
        const seriesTmdbCache = new Map();
        for (const row of seriesTmdbRows) {
            if (row.tmdbId != null)
                seriesTmdbCache.set(row.tmdbId, row.id);
        }
        // Title-matching pre-pass: resolve canonical IDs for items without a TMDB ID
        let moviePrePassMap = new Map();
        let seriesPrePassMap = new Map();
        if (matchingService) {
            const moviesWithoutTmdb = snapshot.movies
                .filter((m) => !movieAvByProviderItemId.has(m.providerItemId) && !parseTmdbId(m.tmdb))
                .map((m) => ({ providerItemId: m.providerItemId, rawTitle: m.rawTitle ?? m.title, mediaType: 'MOVIE' }));
            const seriesWithoutTmdb = snapshot.series
                .filter((s) => !seriesAvByProviderItemId.has(s.providerItemId) && !parseTmdbId(s.tmdb))
                .map((s) => ({ providerItemId: s.providerItemId, rawTitle: s.rawTitle ?? s.title, mediaType: 'SERIES' }));
            console.info(`[catalog-sync] title-match pre-pass: ${moviesWithoutTmdb.length} movies + ` +
                `${seriesWithoutTmdb.length} series without provider TMDB id`);
            await setSyncRunProgress(runId, `Matching TMDB : ${moviesWithoutTmdb.length} films + ${seriesWithoutTmdb.length} séries sans id…`);
            // Run sequentially: movie/series provider item ids often collide as the same string.
            const moviePass = await runTitleMatchPrePass(sourceId, moviesWithoutTmdb, matchingService).catch((err) => {
                console.error('[catalog-sync] movie title-match pre-pass failed:', err);
                return {
                    prePassMap: new Map(),
                    matchStateMap: new Map(),
                    matchedCount: 0,
                    unmatchedCount: moviesWithoutTmdb.length,
                    ambiguousCount: 0,
                };
            });
            const seriesPass = await runTitleMatchPrePass(sourceId, seriesWithoutTmdb, matchingService).catch((err) => {
                console.error('[catalog-sync] series title-match pre-pass failed:', err);
                return {
                    prePassMap: new Map(),
                    matchStateMap: new Map(),
                    matchedCount: 0,
                    unmatchedCount: seriesWithoutTmdb.length,
                    ambiguousCount: 0,
                };
            });
            moviePrePassMap = moviePass.prePassMap;
            seriesPrePassMap = seriesPass.prePassMap;
            counts.titleMatchedCount += moviePass.matchedCount + seriesPass.matchedCount;
            counts.titleUnmatchedCount += moviePass.unmatchedCount + seriesPass.unmatchedCount;
            counts.ambiguousCount += moviePass.ambiguousCount + seriesPass.ambiguousCount;
            counts.unresolvedCount += moviePass.unmatchedCount + seriesPass.unmatchedCount;
            await persistSyncRunProgress(runId, counts);
        }
        else {
            console.info('[catalog-sync] title-match pre-pass skipped (no matchingService / TMDB_API_KEY)');
        }
        // Pre-resolution phase: build a providerItemId → canonicalId map for all NEW movie items.
        // Runs outside transactions so TMDB API calls (via CanonicalResolver) don't hold DB locks.
        const movieResolutionMap = new Map();
        const movieLocalTitleCache = new Map();
        for (const movie of snapshot.movies) {
            const providerItemId = movie.providerItemId;
            if (movieAvByProviderItemId.has(providerItemId))
                continue; // existing availability — no resolution needed
            const tmdbId = parseTmdbId(movie.tmdb);
            const titleKey = localTitleDedupeKey(movie.rawTitle ?? movie.title);
            let resolved = null;
            if (tmdbId != null) {
                // TMDB ID path: prefer CanonicalResolver (real TMDB fetch); fallback to local placeholder
                resolved = canonicalResolver
                    ? await canonicalResolver.resolveMovieCanonical({ tmdbId, tmdbCache: movieTmdbCache })
                    : await importMovieFallback(tmdbId, movieTmdbCache);
                if (resolved)
                    counts.resolvedCount++;
                else
                    counts.unresolvedCount++;
            }
            else {
                // No TMDB ID: use title-match pre-pass result or local dedup within this sync
                const prePassId = moviePrePassMap.get(providerItemId);
                const localId = movieLocalTitleCache.get(titleKey);
                if (prePassId != null) {
                    resolved = { id: prePassId };
                    counts.resolvedCount++;
                }
                else if (localId != null) {
                    resolved = { id: localId };
                    counts.titleMatchedCount++;
                    counts.resolvedCount++;
                }
                else if (moviePrePassMap.has(providerItemId)) {
                    // prePassMap returned null → AMBIGUOUS or UNMATCHED; already counted in pre-pass
                }
                else {
                    // No matchingService ran or item was not in pre-pass scope; skip without creating skeleton
                    counts.unresolvedCount++;
                }
            }
            if (resolved) {
                movieResolutionMap.set(providerItemId, resolved.id);
                if (titleKey !== '::')
                    movieLocalTitleCache.set(titleKey, resolved.id);
            }
        }
        const seriesLocalTitleCache = new Map();
        const seenMovieProviderItemIds = new Set();
        const totalMovies = snapshot.movies.length;
        console.info(`[catalog-sync] upserting ${totalMovies} movies + ${snapshot.series.length} series ` +
            `(chunk=${SYNC_CHUNK_SIZE})`);
        await setSyncRunProgress(runId, `Import en base : 0/${totalMovies} films…`);
        for (let offset = 0; offset < totalMovies; offset += SYNC_CHUNK_SIZE) {
            const chunk = snapshot.movies.slice(offset, offset + SYNC_CHUNK_SIZE);
            await db.transaction(async (tx) => {
                const newAvails = [];
                const appearEvents = [];
                for (const movie of chunk) {
                    const providerItemId = movie.providerItemId;
                    const existing = movieAvByProviderItemId.get(providerItemId);
                    if (!existing) {
                        const movieId = movieResolutionMap.get(providerItemId);
                        if (!movieId) {
                            // AMBIGUOUS or UNMATCHED — skip; no canonical, no availability
                            seenMovieProviderItemIds.add(providerItemId);
                            continue;
                        }
                        const avId = randomUUID();
                        newAvails.push({
                            id: avId,
                            movieId,
                            providerId: sourceId,
                            providerItemId,
                            firstSeenAt: snapshot.fetchedAt,
                            lastSeenAt: snapshot.fetchedAt,
                            status: 'AVAILABLE',
                            rawTitle: sanitizeText(movie.rawTitle),
                            audioLanguage: sanitizeText(movie.audioLanguage),
                            subtitleLanguage: sanitizeText(movie.subtitleLanguage),
                            videoQuality: sanitizeText(movie.videoQuality),
                            codecName: sanitizeText(movie.codecName),
                            hdrFormat: sanitizeText(movie.hdrFormat),
                            releaseHint: sanitizeText(movie.releaseHint),
                            audioFormat: sanitizeText(movie.audioFormat),
                        });
                        appearEvents.push({
                            mediaType: 'MOVIE',
                            mediaId: movieId,
                            eventType: 'SOURCE_APPEARED',
                            occurredAt: snapshot.fetchedAt,
                            sourceId,
                        });
                        movieAvByProviderItemId.set(providerItemId, {
                            id: avId,
                            movieId,
                            status: 'AVAILABLE',
                        });
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
                            codecName: movie.codecName ?? null,
                            hdrFormat: movie.hdrFormat ?? null,
                            releaseHint: movie.releaseHint ?? null,
                            audioFormat: movie.audioFormat ?? null,
                        })
                            .where(eq(movieAvailabilities.id, existing.id));
                        if (wasUnavailable) {
                            appearEvents.push({
                                mediaType: 'MOVIE',
                                mediaId: existing.movieId,
                                eventType: 'SOURCE_APPEARED',
                                occurredAt: snapshot.fetchedAt,
                                sourceId,
                            });
                        }
                        existing.status = 'AVAILABLE';
                        counts.moviesUpdated++;
                    }
                    seenMovieProviderItemIds.add(providerItemId);
                }
                if (newAvails.length > 0) {
                    await tx
                        .insert(movieAvailabilities)
                        .values(newAvails)
                        .onConflictDoNothing({
                        target: [movieAvailabilities.providerId, movieAvailabilities.providerItemId],
                    });
                }
                if (appearEvents.length > 0) {
                    await tx.insert(releaseEvents).values(appearEvents).onConflictDoNothing();
                }
            });
            const done = Math.min(offset + SYNC_CHUNK_SIZE, totalMovies);
            if (done === totalMovies || done % (SYNC_CHUNK_SIZE * 4) === 0 || offset === 0) {
                await persistSyncRunProgress(runId, counts);
                await setSyncRunProgress(runId, `Import en base : ${done}/${totalMovies} films (+${counts.moviesCreated} créés)…`);
                console.info(`[catalog-sync] movies ${done}/${totalMovies} (created=${counts.moviesCreated})`);
            }
        }
        // Pre-resolution phase for series
        const seriesResolutionMap = new Map();
        for (const s of snapshot.series) {
            const providerItemId = s.providerItemId;
            if (seriesAvByProviderItemId.has(providerItemId))
                continue;
            const tmdbId = parseTmdbId(s.tmdb);
            const titleKey = localTitleDedupeKey(s.rawTitle ?? s.title);
            let resolved = null;
            if (tmdbId != null) {
                resolved = canonicalResolver
                    ? await canonicalResolver.resolveSeriesCanonical({ tmdbId, tmdbCache: seriesTmdbCache })
                    : await importSeriesFallback(tmdbId, seriesTmdbCache);
                if (resolved)
                    counts.resolvedCount++;
                else
                    counts.unresolvedCount++;
            }
            else {
                const prePassId = seriesPrePassMap.get(providerItemId);
                const localId = seriesLocalTitleCache.get(titleKey);
                if (prePassId != null) {
                    resolved = { id: prePassId };
                    counts.resolvedCount++;
                }
                else if (localId != null) {
                    resolved = { id: localId };
                    counts.titleMatchedCount++;
                    counts.resolvedCount++;
                }
                else if (seriesPrePassMap.has(providerItemId)) {
                    // prePassMap returned null → AMBIGUOUS or UNMATCHED; already counted in pre-pass
                }
                else {
                    counts.unresolvedCount++;
                }
            }
            if (resolved) {
                seriesResolutionMap.set(providerItemId, resolved.id);
                if (titleKey !== '::')
                    seriesLocalTitleCache.set(titleKey, resolved.id);
            }
        }
        const seenSeriesProviderItemIds = new Set();
        const totalSeries = snapshot.series.length;
        for (let offset = 0; offset < totalSeries; offset += SYNC_CHUNK_SIZE) {
            const chunk = snapshot.series.slice(offset, offset + SYNC_CHUNK_SIZE);
            await db.transaction(async (tx) => {
                const newAvails = [];
                const appearEvents = [];
                for (const s of chunk) {
                    const providerItemId = s.providerItemId;
                    const existing = seriesAvByProviderItemId.get(providerItemId);
                    if (!existing) {
                        const seriesId = seriesResolutionMap.get(providerItemId);
                        if (!seriesId) {
                            // AMBIGUOUS or UNMATCHED — skip; no canonical, no availability
                            seenSeriesProviderItemIds.add(providerItemId);
                            continue;
                        }
                        const avId = randomUUID();
                        newAvails.push({
                            id: avId,
                            seriesId,
                            providerId: sourceId,
                            providerItemId,
                            firstSeenAt: snapshot.fetchedAt,
                            lastSeenAt: snapshot.fetchedAt,
                            status: 'AVAILABLE',
                            rawTitle: sanitizeText(s.rawTitle),
                            audioLanguage: sanitizeText(s.audioLanguage),
                            subtitleLanguage: sanitizeText(s.subtitleLanguage),
                            videoQuality: sanitizeText(s.videoQuality),
                            codecName: sanitizeText(s.codecName),
                            hdrFormat: sanitizeText(s.hdrFormat),
                            releaseHint: sanitizeText(s.releaseHint),
                            audioFormat: sanitizeText(s.audioFormat),
                        });
                        appearEvents.push({
                            mediaType: 'SERIES',
                            mediaId: seriesId,
                            eventType: 'SOURCE_APPEARED',
                            occurredAt: snapshot.fetchedAt,
                            sourceId,
                        });
                        seriesAvByProviderItemId.set(providerItemId, {
                            id: avId,
                            seriesId,
                            status: 'AVAILABLE',
                        });
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
                            codecName: s.codecName ?? null,
                            hdrFormat: s.hdrFormat ?? null,
                            releaseHint: s.releaseHint ?? null,
                            audioFormat: s.audioFormat ?? null,
                        })
                            .where(eq(seriesAvailabilities.id, existing.id));
                        if (wasUnavailable) {
                            appearEvents.push({
                                mediaType: 'SERIES',
                                mediaId: existing.seriesId,
                                eventType: 'SOURCE_APPEARED',
                                occurredAt: snapshot.fetchedAt,
                                sourceId,
                            });
                        }
                        existing.status = 'AVAILABLE';
                        counts.seriesUpdated++;
                    }
                    seenSeriesProviderItemIds.add(providerItemId);
                }
                if (newAvails.length > 0) {
                    await tx
                        .insert(seriesAvailabilities)
                        .values(newAvails)
                        .onConflictDoNothing({
                        target: [seriesAvailabilities.providerId, seriesAvailabilities.providerItemId],
                    });
                }
                if (appearEvents.length > 0) {
                    await tx.insert(releaseEvents).values(appearEvents).onConflictDoNothing();
                }
            });
            const done = Math.min(offset + SYNC_CHUNK_SIZE, totalSeries);
            if (totalSeries > 0 && (done === totalSeries || done % (SYNC_CHUNK_SIZE * 4) === 0 || offset === 0)) {
                await persistSyncRunProgress(runId, counts);
                await setSyncRunProgress(runId, `Import en base : ${done}/${totalSeries} séries (+${counts.seriesCreated} créées)…`);
                console.info(`[catalog-sync] series ${done}/${totalSeries} (created=${counts.seriesCreated})`);
            }
        }
        await db.transaction(async (tx) => {
            // Mark previously available items not in this snapshot as UNAVAILABLE.
            // Skipped in backfill mode to avoid corrupting availability for unrelated items.
            const missingMovieIds = snapshot.skipLifecycle
                ? []
                : [...previouslyAvailableMovieIds].filter((id) => !seenMovieProviderItemIds.has(id));
            if (missingMovieIds.length > 0) {
                const disappearedMovies = await tx
                    .update(movieAvailabilities)
                    .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
                    .where(and(eq(movieAvailabilities.providerId, sourceId), eq(movieAvailabilities.status, 'AVAILABLE'), inArray(movieAvailabilities.providerItemId, missingMovieIds)))
                    .returning({ movieId: movieAvailabilities.movieId });
                if (disappearedMovies.length > 0) {
                    await tx
                        .insert(releaseEvents)
                        .values(disappearedMovies.map(({ movieId }) => ({
                        mediaType: 'MOVIE',
                        mediaId: movieId,
                        eventType: 'SOURCE_DISAPPEARED',
                        occurredAt: snapshot.fetchedAt,
                        sourceId,
                    })))
                        .onConflictDoNothing();
                }
                counts.unavailableCount += missingMovieIds.length;
            }
            const missingSeriesIds = snapshot.skipLifecycle
                ? []
                : [...previouslyAvailableSeriesIds].filter((id) => !seenSeriesProviderItemIds.has(id));
            if (missingSeriesIds.length > 0) {
                const disappearedSeries = await tx
                    .update(seriesAvailabilities)
                    .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
                    .where(and(eq(seriesAvailabilities.providerId, sourceId), eq(seriesAvailabilities.status, 'AVAILABLE'), inArray(seriesAvailabilities.providerItemId, missingSeriesIds)))
                    .returning({ seriesId: seriesAvailabilities.seriesId });
                if (disappearedSeries.length > 0) {
                    await tx
                        .insert(releaseEvents)
                        .values(disappearedSeries.map(({ seriesId }) => ({
                        mediaType: 'SERIES',
                        mediaId: seriesId,
                        eventType: 'SOURCE_DISAPPEARED',
                        occurredAt: snapshot.fetchedAt,
                        sourceId,
                    })))
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
                    const episodeCanonical = canonicalResolver
                        ? await canonicalResolver.resolveEpisodeCanonical({
                            seriesId: seriesAv.seriesId,
                            seasonNumber: ep.seasonNumber,
                            episodeNumber: ep.episodeNumber,
                            episodeMeta: { title: ep.title, synopsis: ep.synopsis, durationMinutes: ep.durationMinutes, airDate: ep.airDate, posterPath: ep.posterPath },
                        })
                        : await resolveEpisodeId(tx, seriesAv.seriesId, ep.seasonNumber, ep.episodeNumber, { title: ep.title, synopsis: ep.synopsis, durationMinutes: ep.durationMinutes, airDate: ep.airDate, posterPath: ep.posterPath }).then((id) => ({ id }));
                    if (!episodeCanonical)
                        continue;
                    const episodeId = episodeCanonical.id;
                    const [existing] = await tx
                        .select({
                        id: episodeAvailabilities.id,
                        episodeId: episodeAvailabilities.episodeId,
                        status: episodeAvailabilities.status,
                    })
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
                            rawTitle: ep.rawTitle ?? null,
                            audioLanguage: ep.audioLanguage ?? null,
                            subtitleLanguage: ep.subtitleLanguage ?? null,
                            videoQuality: ep.videoQuality ?? null,
                            containerExtension: ep.containerExtension ?? null,
                            codecName: ep.codecName ?? null,
                            hdrFormat: ep.hdrFormat ?? null,
                            releaseHint: ep.releaseHint ?? null,
                            audioFormat: ep.audioFormat ?? null,
                        });
                        await tx
                            .insert(releaseEvents)
                            .values({
                            mediaType: 'EPISODE',
                            mediaId: episodeId,
                            eventType: 'SOURCE_APPEARED',
                            occurredAt: snapshot.fetchedAt,
                            sourceId,
                        })
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
                            .set({
                            lastSeenAt: snapshot.fetchedAt,
                            status: 'AVAILABLE',
                            unavailableAt: null,
                            rawTitle: ep.rawTitle ?? null,
                            audioLanguage: ep.audioLanguage ?? null,
                            subtitleLanguage: ep.subtitleLanguage ?? null,
                            videoQuality: ep.videoQuality ?? null,
                            containerExtension: ep.containerExtension ?? null,
                            codecName: ep.codecName ?? null,
                            hdrFormat: ep.hdrFormat ?? null,
                            releaseHint: ep.releaseHint ?? null,
                            audioFormat: ep.audioFormat ?? null,
                        })
                            .where(eq(episodeAvailabilities.id, existing.id));
                        if (wasUnavailable) {
                            await tx
                                .insert(releaseEvents)
                                .values({
                                mediaType: 'EPISODE',
                                mediaId: episodeId,
                                eventType: 'SOURCE_APPEARED',
                                occurredAt: snapshot.fetchedAt,
                                sourceId,
                            })
                                .onConflictDoNothing();
                        }
                    }
                    seenEpisodeProviderItemIds.add(ep.providerItemId);
                }
                if (!snapshot.skipLifecycle) {
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
                                .values({
                                mediaType: 'EPISODE',
                                mediaId: episodeId,
                                eventType: 'SOURCE_DISAPPEARED',
                                occurredAt: snapshot.fetchedAt,
                                sourceId,
                            })
                                .onConflictDoNothing();
                        }
                        counts.unavailableCount += missingEpisodeIds.length;
                    }
                }
            }
        });
    }
    catch (err) {
        const message = formatDbError(err);
        syncError = new Error(message);
        console.error(`[catalog-sync] sync failed runId=${runId}:`, err);
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
        titleMatchedCount: counts.titleMatchedCount,
        titleUnmatchedCount: counts.titleUnmatchedCount,
        resolvedCount: counts.resolvedCount,
        ambiguousCount: counts.ambiguousCount,
        unresolvedCount: counts.unresolvedCount,
        errorMessage: null,
    })
        .where(eq(syncRuns.id, runId));
    return { runId, status: 'completed', counts };
}
export const CatalogSyncService = {
    async syncCatalog(sourceId, snapshot, options) {
        const normalizedEpisodes = snapshot.seriesInfo
            ? Object.entries(snapshot.seriesInfo).flatMap(([seriesIdStr, info]) => Object.entries(info.episodes).flatMap(([seasonKey, episodeList]) => {
                const seasonNumber = parseInt(seasonKey, 10);
                return episodeList.map((ep) => {
                    const { variantAttributes } = normalizeTitle(ep.title);
                    return {
                        providerItemId: ep.id,
                        seriesProviderItemId: seriesIdStr,
                        seasonNumber,
                        episodeNumber: ep.episode_num,
                        title: ep.title ?? null,
                        synopsis: ep.info.plot ?? null,
                        durationMinutes: ep.info.duration_secs
                            ? Math.round(ep.info.duration_secs / 60)
                            : null,
                        airDate: ep.info.releasedate ?? null,
                        posterPath: ep.info.movie_image || ep.info.cover_big || null,
                        rawTitle: ep.title ?? null,
                        containerExtension: ep.container_extension ?? null,
                        audioLanguage: variantAttributes.audioLanguage,
                        subtitleLanguage: variantAttributes.subtitleLanguage,
                        videoQuality: variantAttributes.videoQuality,
                        codecName: variantAttributes.codecName,
                        hdrFormat: variantAttributes.hdrFormat,
                        releaseHint: variantAttributes.releaseHint,
                        audioFormat: variantAttributes.audioFormat,
                    };
                });
            }))
            : undefined;
        return syncNormalized(sourceId, {
            sourceId: snapshot.sourceId,
            fetchedAt: snapshot.fetchedAt,
            movies: snapshot.vodStreams.map((s) => {
                const rawName = typeof s.name === 'string' ? s.name : '';
                const { variantAttributes } = normalizeTitle(rawName || `stream-${s.stream_id}`);
                return {
                    providerItemId: s.stream_id.toString(),
                    title: rawName || `Untitled (${s.stream_id})`,
                    posterPath: s.cover,
                    synopsis: s.plot ?? s.description,
                    tmdb: s.tmdb,
                    rawTitle: rawName || null,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                    codecName: variantAttributes.codecName,
                    hdrFormat: variantAttributes.hdrFormat,
                    releaseHint: variantAttributes.releaseHint,
                    audioFormat: variantAttributes.audioFormat,
                };
            }),
            series: snapshot.series.map((s) => {
                const rawName = typeof s.name === 'string' ? s.name : '';
                const { variantAttributes } = normalizeTitle(rawName || `series-${s.series_id}`);
                return {
                    providerItemId: s.series_id.toString(),
                    title: rawName || `Untitled (${s.series_id})`,
                    posterPath: s.cover,
                    synopsis: s.plot,
                    tmdb: snapshot.seriesInfo?.[s.series_id]?.info.tmdb_id,
                    firstAirYear: parseYear(s.releaseDate),
                    rawTitle: rawName || null,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                    codecName: variantAttributes.codecName,
                    hdrFormat: variantAttributes.hdrFormat,
                    releaseHint: variantAttributes.releaseHint,
                    audioFormat: variantAttributes.audioFormat,
                };
            }),
            episodes: normalizedEpisodes,
            failedSeriesProviderIds: snapshot.failedSeriesIds?.map(String),
            skipLifecycle: options?.skipLifecycle,
        }, options?.runId, options?.matchingService, options?.canonicalResolver);
    },
    async syncPlexCatalog(sourceId, snapshot, options) {
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
        }, options?.runId, options?.matchingService, options?.canonicalResolver);
    },
    async syncM3UCatalog(sourceId, snapshot, options) {
        // Derive unique series entries from episode seriesKeys
        const seriesMap = new Map();
        for (const ep of snapshot.episodes) {
            const key = ep.seriesKey ?? ep.streamUrl;
            if (!seriesMap.has(key)) {
                const { variantAttributes } = normalizeTitle(ep.rawTitle);
                seriesMap.set(key, {
                    providerItemId: key,
                    title: ep.tvgName ?? ep.rawTitle,
                    posterPath: ep.tvgLogo ?? null,
                    synopsis: null,
                    tmdb: undefined,
                    firstAirYear: null,
                    rawTitle: ep.rawTitle,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                });
            }
        }
        return syncNormalized(sourceId, {
            sourceId: snapshot.sourceId,
            fetchedAt: snapshot.fetchedAt,
            movies: snapshot.movies.map((entry) => {
                const { variantAttributes } = normalizeTitle(entry.rawTitle);
                return {
                    providerItemId: entry.tvgId ?? entry.streamUrl,
                    title: entry.tvgName ?? entry.rawTitle,
                    posterPath: entry.tvgLogo ?? null,
                    synopsis: null,
                    tmdb: undefined,
                    rawTitle: entry.rawTitle,
                    audioLanguage: variantAttributes.audioLanguage,
                    subtitleLanguage: variantAttributes.subtitleLanguage,
                    videoQuality: variantAttributes.videoQuality,
                };
            }),
            series: [...seriesMap.values()],
            episodes: snapshot.episodes.map((entry) => ({
                providerItemId: entry.tvgId ?? entry.streamUrl,
                seriesProviderItemId: entry.seriesKey ?? entry.streamUrl,
                seasonNumber: entry.seasonNumber ?? 1,
                episodeNumber: entry.episodeNumber ?? 1,
            })),
        }, options?.runId, options?.matchingService, options?.canonicalResolver);
    },
};
//# sourceMappingURL=catalog-sync-service.js.map