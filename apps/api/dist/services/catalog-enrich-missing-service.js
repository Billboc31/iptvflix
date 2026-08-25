import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { catalogRefreshRuns } from '../db/schema/catalog-refresh-runs.js';
import { enrichmentFailures } from '../db/schema/enrichment-failures.js';
const ENRICH_MISSING_STALE_DAYS = 30;
const TRANSIENT_RETRY_DELAYS_MS = [250, 500, 1000];
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runWithConcurrency(items, concurrency, handler) {
    let index = 0;
    let active = 0;
    await new Promise((resolve, reject) => {
        function next() {
            while (active < concurrency && index < items.length) {
                const item = items[index++];
                active++;
                handler(item)
                    .catch((err) => console.warn('[enrich-missing] item error:', err))
                    .finally(() => {
                    active--;
                    if (index >= items.length && active === 0)
                        resolve();
                    else
                        next();
                });
            }
            if (items.length === 0)
                resolve();
        }
        try {
            next();
        }
        catch (e) {
            reject(e);
        }
    });
}
export class CatalogEnrichMissingService {
    db;
    enrichmentService;
    constructor(db, enrichmentService) {
        this.db = db;
        this.enrichmentService = enrichmentService;
    }
    async checkNoRunningConflict() {
        const [existing] = await this.db
            .select({ id: catalogRefreshRuns.id, type: catalogRefreshRuns.type })
            .from(catalogRefreshRuns)
            .where(eq(catalogRefreshRuns.status, 'RUNNING'))
            .limit(1);
        if (existing) {
            const err = new Error(`A ${existing.type} run is already RUNNING (id: ${existing.id})`);
            Object.assign(err, { code: 'RUN_CONFLICT' });
            throw err;
        }
    }
    async enrichWithRetry(fn, onRetry) {
        for (let attempt = 0; attempt < TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
            const result = await fn();
            if (result !== 'provider-failed')
                return result;
            if (attempt < TRANSIENT_RETRY_DELAYS_MS.length - 1) {
                onRetry?.();
                await delay(TRANSIENT_RETRY_DELAYS_MS[attempt]);
            }
        }
        return 'provider-failed';
    }
    async countEligible(mediaType, force) {
        const table = mediaType === 'MOVIE' ? movies : series;
        const threshold = new Date(Date.now() - ENRICH_MISSING_STALE_DAYS * 86_400_000);
        const where = and(isNotNull(table.tmdbId), eq(table.matchStatus, 'MATCHED'), force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)));
        const [row] = await this.db.select({ cnt: count() }).from(table).where(where);
        return Number(row?.cnt ?? 0);
    }
    async start(opts = {}) {
        const { mediaTypes = ['MOVIE', 'SERIES'], batchSize = 50, concurrency = 3, throttleMs = 250, force = false, resumeRunId, } = opts;
        await this.checkNoRunningConflict();
        let run;
        try {
            const [inserted] = await this.db
                .insert(catalogRefreshRuns)
                .values({ type: 'ENRICH_MISSING', status: 'RUNNING', checkpoint: null })
                .returning({ id: catalogRefreshRuns.id });
            run = inserted;
        }
        catch (err) {
            // Partial unique index violation: another run became RUNNING between check and insert
            if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
                const conflict = new Error('A run is already RUNNING (concurrent insert detected)');
                Object.assign(conflict, { code: 'RUN_CONFLICT' });
                throw conflict;
            }
            throw err;
        }
        const runId = run.id;
        const checkpoint = {
            movies: { lastId: null, processedCount: 0, done: !mediaTypes.includes('MOVIE') },
            series: { lastId: null, processedCount: 0, done: !mediaTypes.includes('SERIES') },
        };
        // Resume from a previous run's cursor position if requested
        if (resumeRunId) {
            const [prevRun] = await this.db
                .select({ checkpoint: catalogRefreshRuns.checkpoint })
                .from(catalogRefreshRuns)
                .where(eq(catalogRefreshRuns.id, resumeRunId))
                .limit(1);
            const prev = prevRun?.checkpoint;
            if (prev) {
                if (prev.movies) {
                    checkpoint.movies.lastId = prev.movies.done ? null : prev.movies.lastId;
                    checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE');
                }
                if (prev.series) {
                    checkpoint.series.lastId = prev.series.done ? null : prev.series.lastId;
                    checkpoint.series.done = prev.series.done || !mediaTypes.includes('SERIES');
                }
            }
        }
        const totalMovies = mediaTypes.includes('MOVIE') ? await this.countEligible('MOVIE', force) : 0;
        const totalSeries = mediaTypes.includes('SERIES') ? await this.countEligible('SERIES', force) : 0;
        const stats = {
            totalEligible: totalMovies + totalSeries,
            processed: 0,
            enriched: 0,
            skipped: 0,
            retrying: 0,
            failedTerminal: 0,
        };
        const startMs = Date.now();
        const saveCheckpoint = async () => {
            const elapsedMin = (Date.now() - startMs) / 60_000;
            const rate = elapsedMin > 0 ? stats.processed / elapsedMin : 0;
            const remaining = stats.totalEligible - stats.processed;
            const eta = rate > 0 ? (remaining / rate) * 60 : null;
            checkpoint.stats = { ...stats, remaining, ratePerMinute: rate, etaSeconds: eta };
            await this.db
                .update(catalogRefreshRuns)
                .set({ checkpoint })
                .where(eq(catalogRefreshRuns.id, runId));
        };
        void this.execute({
            runId,
            mediaTypes,
            batchSize,
            concurrency,
            throttleMs,
            force,
            checkpoint,
            stats,
            saveCheckpoint,
        }).catch((err) => {
            console.error('[enrich-missing] run failed:', err);
            void this.db
                .update(catalogRefreshRuns)
                .set({ status: 'FAILED', completedAt: new Date(), errorMessage: String(err) })
                .where(eq(catalogRefreshRuns.id, runId));
        });
        return runId;
    }
    async execute(ctx) {
        const { runId, mediaTypes, batchSize, concurrency, throttleMs, force, checkpoint, stats, saveCheckpoint } = ctx;
        const threshold = new Date(Date.now() - ENRICH_MISSING_STALE_DAYS * 86_400_000);
        for (const mediaType of mediaTypes) {
            const key = mediaType === 'MOVIE' ? 'movies' : 'series';
            const table = mediaType === 'MOVIE' ? movies : series;
            while (!checkpoint[key].done) {
                const lastId = checkpoint[key].lastId;
                const eligible = and(isNotNull(table.tmdbId), eq(table.matchStatus, 'MATCHED'), force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)), lastId ? gt(table.id, lastId) : undefined);
                const batch = await this.db
                    .select({ id: table.id })
                    .from(table)
                    .where(eligible)
                    .orderBy(asc(table.id))
                    .limit(batchSize);
                if (batch.length === 0) {
                    checkpoint[key].done = true;
                    await saveCheckpoint();
                    break;
                }
                await runWithConcurrency(batch, concurrency, async (row) => {
                    try {
                        const result = mediaType === 'MOVIE'
                            ? await this.enrichWithRetry(() => this.enrichmentService.enrichMovie(row.id, { force, runId }), () => { stats.retrying++; })
                            : await this.enrichWithRetry(() => this.enrichmentService.enrichSeries(row.id, { force, runId }), () => { stats.retrying++; });
                        stats.processed++;
                        checkpoint[key].processedCount++;
                        if (result === 'enriched')
                            stats.enriched++;
                        else if (result === 'skipped' || result === 'no-tmdb-id')
                            stats.skipped++;
                        else
                            stats.failedTerminal++;
                    }
                    catch {
                        stats.processed++;
                        stats.failedTerminal++;
                        checkpoint[key].processedCount++;
                    }
                });
                checkpoint[key].lastId = batch[batch.length - 1].id;
                await saveCheckpoint();
                if (batch.length < batchSize) {
                    checkpoint[key].done = true;
                    await saveCheckpoint();
                    break;
                }
                if (throttleMs > 0)
                    await delay(throttleMs);
            }
        }
        await this.db
            .update(catalogRefreshRuns)
            .set({ status: 'COMPLETED', completedAt: new Date(), failedCount: stats.failedTerminal })
            .where(eq(catalogRefreshRuns.id, runId));
    }
    async getLatestRunStatus() {
        const [run] = await this.db
            .select()
            .from(catalogRefreshRuns)
            .where(eq(catalogRefreshRuns.type, 'ENRICH_MISSING'))
            .orderBy(sql `started_at DESC`)
            .limit(1);
        if (!run)
            return null;
        const cp = run.checkpoint;
        const stats = cp?.stats
            ? {
                totalEligible: cp.stats.totalEligible ?? 0,
                processed: cp.stats.processed ?? 0,
                enriched: cp.stats.enriched ?? 0,
                skipped: cp.stats.skipped ?? 0,
                retrying: cp.stats.retrying ?? 0,
                failedTerminal: cp.stats.failedTerminal ?? 0,
                remaining: cp.stats.remaining ?? 0,
                ratePerMinute: cp.stats.ratePerMinute ?? 0,
                etaSeconds: cp.stats.etaSeconds ?? null,
            }
            : null;
        return {
            runId: run.id,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt ?? null,
            stats,
        };
    }
    async listFailures(opts) {
        const { page, limit, mediaType, retryable } = opts;
        const offset = (page - 1) * limit;
        const conditions = [];
        if (mediaType)
            conditions.push(eq(enrichmentFailures.mediaType, mediaType));
        if (retryable !== undefined)
            conditions.push(eq(enrichmentFailures.retryable, retryable));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const [rows, totalRow] = await Promise.all([
            this.db
                .select()
                .from(enrichmentFailures)
                .where(where)
                .orderBy(sql `occurred_at DESC`)
                .limit(limit)
                .offset(offset),
            this.db.select({ cnt: count() }).from(enrichmentFailures).where(where),
        ]);
        return { rows, total: Number(totalRow[0]?.cnt ?? 0) };
    }
    async retryFailures(opts = {}) {
        const { mediaType, ids, concurrency = 3, force = false } = opts;
        await this.checkNoRunningConflict();
        const conditions = [];
        if (mediaType)
            conditions.push(eq(enrichmentFailures.mediaType, mediaType));
        if (ids && ids.length > 0)
            conditions.push(inArray(enrichmentFailures.mediaId, ids));
        // By default only retry retryable failures; pass force=true to retry all (including terminal)
        if (!force)
            conditions.push(eq(enrichmentFailures.retryable, true));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const failures = await this.db.select().from(enrichmentFailures).where(where);
        if (failures.length === 0) {
            return { runId: null, queued: 0 };
        }
        let run;
        try {
            const [inserted] = await this.db
                .insert(catalogRefreshRuns)
                .values({ type: 'ENRICH_MISSING', status: 'RUNNING', checkpoint: null })
                .returning({ id: catalogRefreshRuns.id });
            run = inserted;
        }
        catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
                const conflict = new Error('A run is already RUNNING (concurrent insert detected)');
                Object.assign(conflict, { code: 'RUN_CONFLICT' });
                throw conflict;
            }
            throw err;
        }
        const runId = run.id;
        const stats = {
            totalEligible: failures.length,
            processed: 0,
            enriched: 0,
            skipped: 0,
            retrying: 0,
            failedTerminal: 0,
        };
        void runWithConcurrency(failures, concurrency, async (failure) => {
            const mt = failure.mediaType;
            try {
                const result = mt === 'MOVIE'
                    ? await this.enrichWithRetry(() => this.enrichmentService.enrichMovie(failure.mediaId, { force: true, runId }), () => { stats.retrying++; })
                    : await this.enrichWithRetry(() => this.enrichmentService.enrichSeries(failure.mediaId, { force: true, runId }), () => { stats.retrying++; });
                stats.processed++;
                if (result === 'enriched')
                    stats.enriched++;
                else if (result === 'skipped' || result === 'no-tmdb-id')
                    stats.skipped++;
                else
                    stats.failedTerminal++;
            }
            catch {
                stats.processed++;
                stats.failedTerminal++;
            }
        }).then(async () => {
            const finalCheckpoint = { stats: { ...stats, remaining: stats.failedTerminal, ratePerMinute: 0, etaSeconds: null } };
            await this.db
                .update(catalogRefreshRuns)
                .set({ status: 'COMPLETED', completedAt: new Date(), checkpoint: finalCheckpoint, failedCount: stats.failedTerminal })
                .where(eq(catalogRefreshRuns.id, runId));
        }).catch(async (err) => {
            await this.db
                .update(catalogRefreshRuns)
                .set({ status: 'FAILED', completedAt: new Date(), errorMessage: String(err) })
                .where(eq(catalogRefreshRuns.id, runId));
        });
        return { runId, queued: failures.length };
    }
}
//# sourceMappingURL=catalog-enrich-missing-service.js.map