import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sources } from '../db/schema/sources.js';
import { syncRuns } from '../db/schema/sync-runs.js';
import { XtreamCodesClient } from '../providers/xtream/client.js';
import { PlexClient } from '../providers/plex/client.js';
import { M3UClient } from '../providers/m3u/client.js';
import { M3UAuthError, M3UNetworkError, M3UParseError } from '../providers/m3u/errors.js';
import { CatalogSyncService, SyncAlreadyRunningError, } from './catalog-sync-service.js';
import { NotFoundError } from './source-service.js';
function toResponse(row) {
    const status = row.status === 'COMPLETED' ? 'DONE' : row.status;
    return {
        id: row.id,
        sourceId: row.sourceId,
        status,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.completedAt ? row.completedAt.toISOString() : null,
        moviesAdded: row.moviesCreated,
        seriesAdded: row.seriesCreated,
        seriesInfoFailed: row.failedCount,
        error: row.errorMessage ?? null,
    };
}
export async function withBoundedConcurrency(tasks, limit) {
    const results = new Array(tasks.length);
    const queue = tasks.map((task, i) => ({ task, i }));
    async function worker() {
        while (queue.length > 0) {
            const item = queue.shift();
            try {
                results[item.i] = { status: 'fulfilled', value: await item.task() };
            }
            catch (err) {
                results[item.i] = { status: 'rejected', reason: err };
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
    return results;
}
export async function listSyncRuns() {
    const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50);
    return rows.map(toResponse);
}
async function fetchXtreamSnapshot(source) {
    const client = new XtreamCodesClient({
        baseUrl: source.baseUrl,
        username: source.username ?? '',
        password: source.password ?? '',
        timeoutMs: 60_000,
    });
    await client.authenticate();
    const [vodCategories, vodStreams, seriesCategories, series] = await Promise.all([
        client.getVodCategories(),
        client.getVodStreams(),
        client.getSeriesCategories(),
        client.getSeries(),
    ]);
    const concurrencyLimit = parseInt(process.env.XTREAM_SERIES_CONCURRENCY ?? '5', 10);
    const settledResults = await withBoundedConcurrency(series.map((s) => async () => {
        const info = await client.getSeriesInfo(s.series_id);
        return [s.series_id, info];
    }), concurrencyLimit);
    const seriesInfo = {};
    const failedSeriesIds = [];
    for (let i = 0; i < settledResults.length; i++) {
        const r = settledResults[i];
        if (r.status === 'fulfilled') {
            const [id, info] = r.value;
            seriesInfo[id] = info;
        }
        else {
            failedSeriesIds.push(series[i].series_id);
            console.warn(`[xtream-snapshot] getSeriesInfo(${series[i].series_id}) failed:`, r.reason);
        }
    }
    return {
        sourceId: source.id,
        fetchedAt: new Date(),
        vodCategories,
        vodStreams,
        seriesCategories,
        series,
        seriesInfo,
        failedSeriesIds: failedSeriesIds.length > 0 ? failedSeriesIds : undefined,
    };
}
async function fetchM3USnapshot(source) {
    const timeoutMs = parseInt(process.env.M3U_FETCH_TIMEOUT_MS ?? '60000', 10);
    const client = new M3UClient({
        playlistUrl: source.baseUrl,
        username: source.username ?? undefined,
        password: source.password ?? undefined,
        timeoutMs,
    });
    return client.fetchSnapshot(source.id);
}
async function fetchPlexSnapshot(source) {
    const client = new PlexClient(source.baseUrl, source.password ?? '', 60_000);
    const sections = await client.fetchLibrarySections();
    const movieSections = sections.filter((s) => s.type === 'movie');
    const showSections = sections.filter((s) => s.type === 'show');
    const [allMovies, allShows, allEpisodes] = await Promise.all([
        Promise.all(movieSections.map((s) => client.fetchMovies(s.key))).then((arrays) => arrays.flat()),
        Promise.all(showSections.map((s) => client.fetchShows(s.key))).then((arrays) => arrays.flat()),
        Promise.all(showSections.map((s) => client.fetchEpisodes(s.key))).then((arrays) => arrays.flat()),
    ]);
    return {
        sourceId: source.id,
        fetchedAt: new Date(),
        movies: allMovies,
        shows: allShows,
        episodes: allEpisodes,
    };
}
export async function triggerSync(body) {
    if (!body?.sourceId) {
        const err = new Error('sourceId is required');
        err.statusCode = 400;
        throw err;
    }
    const [source] = await db.select().from(sources).where(eq(sources.id, body.sourceId));
    if (!source)
        throw new NotFoundError(body.sourceId);
    if (!source.enabled) {
        const err = new Error('Source is disabled');
        err.statusCode = 400;
        throw err;
    }
    if (source.type !== 'XTREAM' && source.type !== 'PLEX' && source.type !== 'M3U') {
        const err = new Error('Only XTREAM, PLEX, and M3U sources can be synchronized');
        err.statusCode = 400;
        throw err;
    }
    try {
        let result;
        if (source.type === 'PLEX') {
            const snapshot = await fetchPlexSnapshot(source);
            result = await CatalogSyncService.syncPlexCatalog(source.id, snapshot);
        }
        else if (source.type === 'M3U') {
            let snapshot;
            try {
                snapshot = await fetchM3USnapshot(source);
            }
            catch (fetchErr) {
                if (fetchErr instanceof M3UAuthError ||
                    fetchErr instanceof M3UNetworkError ||
                    fetchErr instanceof M3UParseError) {
                    const [failedRun] = await db
                        .insert(syncRuns)
                        .values({
                        sourceId: source.id,
                        status: 'FAILED',
                        completedAt: new Date(),
                        errorMessage: fetchErr.message,
                    })
                        .returning();
                    return toResponse(failedRun);
                }
                throw fetchErr;
            }
            result = await CatalogSyncService.syncM3UCatalog(source.id, snapshot);
        }
        else {
            const snapshot = await fetchXtreamSnapshot(source);
            result = await CatalogSyncService.syncCatalog(source.id, snapshot);
        }
        const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.runId));
        if (!row) {
            throw new Error('Sync completed but run record is missing');
        }
        return toResponse(row);
    }
    catch (err) {
        if (err instanceof SyncAlreadyRunningError) {
            const conflict = new Error(err.message);
            conflict.statusCode = 409;
            throw conflict;
        }
        throw err;
    }
}
//# sourceMappingURL=sync-runs-service.js.map