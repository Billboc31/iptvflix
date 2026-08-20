import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { sources } from '../db/schema/sources.js';
import { syncRuns } from '../db/schema/sync-runs.js';
import { episodes } from '../db/schema/episodes.js';
import { seasons } from '../db/schema/seasons.js';
import { series } from '../db/schema/series.js';
import { mediaSegments } from '../db/schema/media-segments.js';
import { CatalogRefreshAlreadyRunningError } from './catalog-refresh-service.js';
async function withBoundedConcurrency(tasks, limit) {
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
const ALL_FEEDS = ['popular', 'trending', 'upcoming'];
const ALL_MEDIA_TYPES = ['MOVIE', 'SERIES'];
export class SchedulerService {
    db;
    triggerSync;
    discoveryPoolService;
    config;
    catalogRefreshService;
    segmentSyncService;
    episodeBackfillService;
    startupTimer = null;
    sourceSyncTimer = null;
    discoveryTimer = null;
    catalogRefreshTimer = null;
    segmentRefreshTimer = null;
    episodeBackfillTimer = null;
    segmentRefreshTickCount = 0;
    constructor(db, triggerSync, discoveryPoolService, config, catalogRefreshService = null, segmentSyncService = null, episodeBackfillService = null) {
        this.db = db;
        this.triggerSync = triggerSync;
        this.discoveryPoolService = discoveryPoolService;
        this.config = config;
        this.catalogRefreshService = catalogRefreshService;
        this.segmentSyncService = segmentSyncService;
        this.episodeBackfillService = episodeBackfillService;
    }
    start() {
        if (!this.config.enabled)
            return;
        this.startupTimer = setTimeout(() => {
            this.startupTimer = null;
            void this.runSourceSyncTick();
            void this.runDiscoveryTick();
            this.sourceSyncTimer = setInterval(() => void this.runSourceSyncTick(), this.config.sourceSyncCadenceMinutes * 60_000);
            this.discoveryTimer = setInterval(() => void this.runDiscoveryTick(), this.config.discoveryCadenceMinutes * 60_000);
            if ((this.config.catalogRefreshEnabled ?? true) && this.catalogRefreshService) {
                void this.runCatalogRefreshTick();
                this.catalogRefreshTimer = setInterval(() => void this.runCatalogRefreshTick(), (this.config.catalogRefreshCadenceHours ?? 24) * 3_600_000);
            }
            if ((this.config.segmentRefreshEnabled ?? false) && this.segmentSyncService) {
                void this.runSegmentRefreshTick();
                this.segmentRefreshTimer = setInterval(() => void this.runSegmentRefreshTick(), (this.config.segmentRefreshCadenceHours ?? 24) * 3_600_000);
            }
            if (this.episodeBackfillService) {
                void this.runEpisodeBackfillTick();
                this.episodeBackfillTimer = setInterval(() => void this.runEpisodeBackfillTick(), (this.config.episodeBackfillCadenceMinutes ?? 120) * 60_000);
            }
        }, this.config.startupDelayMs);
    }
    stop() {
        if (this.startupTimer !== null) {
            clearTimeout(this.startupTimer);
            this.startupTimer = null;
        }
        if (this.sourceSyncTimer !== null) {
            clearInterval(this.sourceSyncTimer);
            this.sourceSyncTimer = null;
        }
        if (this.discoveryTimer !== null) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
        if (this.catalogRefreshTimer !== null) {
            clearInterval(this.catalogRefreshTimer);
            this.catalogRefreshTimer = null;
        }
        if (this.segmentRefreshTimer !== null) {
            clearInterval(this.segmentRefreshTimer);
            this.segmentRefreshTimer = null;
        }
        if (this.episodeBackfillTimer !== null) {
            clearInterval(this.episodeBackfillTimer);
            this.episodeBackfillTimer = null;
        }
    }
    async runSourceSyncTick() {
        let enabledSources;
        try {
            enabledSources = await this.db.select().from(sources).where(eq(sources.enabled, true));
        }
        catch (err) {
            console.error('[scheduler] Failed to fetch enabled sources:', err);
            return;
        }
        const cadenceMs = this.config.sourceSyncCadenceMinutes * 60_000;
        const now = Date.now();
        const tasks = enabledSources.map((source) => async () => {
            try {
                const [lastRun] = await this.db
                    .select()
                    .from(syncRuns)
                    .where(and(eq(syncRuns.sourceId, source.id), eq(syncRuns.status, 'COMPLETED')))
                    .orderBy(desc(syncRuns.completedAt))
                    .limit(1);
                const lastCompleted = lastRun?.completedAt?.getTime() ?? 0;
                if (now - lastCompleted < cadenceMs)
                    return;
                await this.triggerSync({ sourceId: source.id });
            }
            catch (err) {
                const statusCode = err.statusCode;
                if (statusCode === 409) {
                    console.debug(`[scheduler] Source ${source.id} already syncing, skipping`);
                    return;
                }
                console.error(`[scheduler] Source ${source.id} sync error:`, err);
            }
        });
        await withBoundedConcurrency(tasks, this.config.sourceSyncConcurrency);
    }
    async runDiscoveryTick() {
        if (!this.discoveryPoolService)
            return;
        try {
            await this.discoveryPoolService.evictStale();
            await this.discoveryPoolService.refreshPool([...ALL_FEEDS], [...ALL_MEDIA_TYPES]);
        }
        catch (err) {
            console.error('[scheduler] Discovery tick error:', err);
        }
    }
    async runCatalogRefreshTick() {
        if (!this.catalogRefreshService)
            return;
        try {
            const last = await this.catalogRefreshService.getLastCompletedRun();
            const cadenceMs = (this.config.catalogRefreshCadenceHours ?? 24) * 3_600_000;
            if (last?.completedAt && Date.now() - last.completedAt.getTime() < cadenceMs)
                return;
            await this.catalogRefreshService.run();
        }
        catch (err) {
            if (err instanceof CatalogRefreshAlreadyRunningError) {
                console.debug('[scheduler] Catalog refresh already running, skipping');
                return;
            }
            console.error('[scheduler] Catalog refresh tick error:', err);
        }
    }
    async runEpisodeBackfillTick() {
        if (!this.episodeBackfillService)
            return;
        try {
            const result = await this.episodeBackfillService.backfill();
            if (result.processed > 0) {
                console.info('[scheduler] episode backfill tick', result);
            }
        }
        catch (err) {
            console.error('[scheduler] episode backfill tick error:', err);
        }
    }
    async runSegmentRefreshTick() {
        if (!this.segmentSyncService)
            return;
        this.segmentRefreshTickCount++;
        const tick = this.segmentRefreshTickCount;
        const recentDays = this.config.segmentRefreshRecentDays ?? 30;
        const recentCutoff = new Date(Date.now() - recentDays * 86_400_000);
        const CONCURRENCY = 3;
        try {
            // Priority 1: episodes aired recently — refresh every tick
            const recentRows = await this.db
                .select({
                episodeId: episodes.id,
                episodeNumber: episodes.episodeNumber,
                seriesId: episodes.seriesId,
                seasonNumber: seasons.seasonNumber,
            })
                .from(episodes)
                .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
                .innerJoin(series, eq(episodes.seriesId, series.id))
                .where(and(gt(episodes.airDate, recentCutoff.toISOString().slice(0, 10)), sql `${series.tmdbId} IS NOT NULL`))
                .limit(100);
            const recentTasks = recentRows.map((row) => () => this.segmentSyncService.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber));
            await withBoundedConcurrency(recentTasks, CONCURRENCY);
            // Priority 2: no-data episodes — retry every 3 ticks
            if (tick % 3 === 0) {
                const noDataRows = await this.db
                    .select({
                    episodeId: episodes.id,
                    episodeNumber: episodes.episodeNumber,
                    seriesId: episodes.seriesId,
                    seasonNumber: seasons.seasonNumber,
                })
                    .from(episodes)
                    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
                    .innerJoin(series, eq(episodes.seriesId, series.id))
                    .where(and(sql `${series.tmdbId} IS NOT NULL`, isNull(this.db
                    .select({ id: mediaSegments.id })
                    .from(mediaSegments)
                    .where(eq(mediaSegments.episodeId, episodes.id))
                    .limit(1)
                    .as('seg'))))
                    .limit(50);
                const noDataTasks = noDataRows.map((row) => () => this.segmentSyncService.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber));
                await withBoundedConcurrency(noDataTasks, CONCURRENCY);
            }
            // Priority 3: stable episodes — refresh every 7 ticks
            if (tick % 7 === 0) {
                const stableRows = await this.db
                    .select({
                    episodeId: episodes.id,
                    episodeNumber: episodes.episodeNumber,
                    seriesId: episodes.seriesId,
                    seasonNumber: seasons.seasonNumber,
                })
                    .from(episodes)
                    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
                    .innerJoin(series, eq(episodes.seriesId, series.id))
                    .where(and(or(isNull(episodes.airDate), sql `${episodes.airDate} <= ${recentCutoff.toISOString().slice(0, 10)}`), sql `${series.tmdbId} IS NOT NULL`))
                    .limit(50);
                const stableTasks = stableRows.map((row) => () => this.segmentSyncService.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber));
                await withBoundedConcurrency(stableTasks, CONCURRENCY);
            }
        }
        catch (err) {
            console.error('[scheduler] Segment refresh tick error:', err);
        }
    }
}
//# sourceMappingURL=scheduler-service.js.map