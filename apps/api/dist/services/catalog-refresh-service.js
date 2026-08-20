import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { catalogRefreshRuns } from '../db/schema/catalog-refresh-runs.js';
import { CATALOG_REFRESH_UPCOMING_STALE_HOURS, CATALOG_REFRESH_RECENT_STALE_DAYS, CATALOG_REFRESH_STABLE_STALE_DAYS, CATALOG_REFRESH_DISCOVERY_MAX_PAGES, } from '../config/env.js';
const PAGE_SIZE = 50;
const STALE_LOCK_HOURS = 2;
const THROTTLE_MS = 250;
export class CatalogRefreshAlreadyRunningError extends Error {
    constructor() {
        super('A catalog refresh run is already in progress');
        this.name = 'CatalogRefreshAlreadyRunningError';
    }
}
const MOVIE_UPCOMING_STATUSES = ['Rumored', 'Planned', 'In Production', 'Post Production'];
const SERIES_UPCOMING_STATUSES = ['In Production', 'Planned'];
export function classifyMovieBucket(movie, now = new Date()) {
    const cutoff60 = new Date(+now - 60 * 86_400_000);
    const cutoff90 = new Date(+now - 90 * 86_400_000);
    if ((movie.status !== null && MOVIE_UPCOMING_STATUSES.includes(movie.status)) ||
        (movie.theatricalReleaseDate !== null && new Date(movie.theatricalReleaseDate) > cutoff60)) {
        return 'upcoming';
    }
    if (movie.theatricalReleaseDate !== null && new Date(movie.theatricalReleaseDate) > cutoff90) {
        return 'recent';
    }
    return 'stable';
}
export function classifySeriesBucket(show) {
    if (show.status !== null && SERIES_UPCOMING_STATUSES.includes(show.status))
        return 'upcoming';
    return 'stable';
}
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const DISCOVERY_FEEDS = ['upcoming', 'trending'];
export class CatalogRefreshService {
    db;
    provider;
    enrichmentService;
    config;
    constructor(db, provider, enrichmentService, config) {
        this.db = db;
        this.provider = provider;
        this.enrichmentService = enrichmentService;
        this.config = {
            upcomingStaleHours: CATALOG_REFRESH_UPCOMING_STALE_HOURS,
            recentStaleDays: CATALOG_REFRESH_RECENT_STALE_DAYS,
            stableStaleDays: CATALOG_REFRESH_STABLE_STALE_DAYS,
            discoveryMaxPages: CATALOG_REFRESH_DISCOVERY_MAX_PAGES,
            ...config,
        };
    }
    async run() {
        // Clear stale RUNNING locks older than STALE_LOCK_HOURS
        await this.db
            .update(catalogRefreshRuns)
            .set({ status: 'FAILED', errorMessage: 'Stale lock cleared', completedAt: new Date() })
            .where(and(eq(catalogRefreshRuns.status, 'RUNNING'), lt(catalogRefreshRuns.startedAt, new Date(Date.now() - STALE_LOCK_HOURS * 3_600_000))));
        const running = await this.db
            .select({ id: catalogRefreshRuns.id })
            .from(catalogRefreshRuns)
            .where(eq(catalogRefreshRuns.status, 'RUNNING'))
            .limit(1);
        if (running.length > 0)
            throw new CatalogRefreshAlreadyRunningError();
        const [run] = await this.db
            .insert(catalogRefreshRuns)
            .values({ status: 'RUNNING' })
            .returning({ id: catalogRefreshRuns.id });
        void this.execute(run.id);
        return run.id;
    }
    async execute(runId) {
        try {
            const [runRow] = await this.db
                .select({ checkpoint: catalogRefreshRuns.checkpoint })
                .from(catalogRefreshRuns)
                .where(eq(catalogRefreshRuns.id, runId));
            const checkpoint = runRow?.checkpoint ?? {};
            const counts = {
                moviesRefreshed: 0,
                seriesRefreshed: 0,
                moviesImported: 0,
                seriesImported: 0,
                failedCount: 0,
            };
            let lastError;
            // Refresh buckets — movies
            await this.runRefreshBucket({
                runId, key: 'refresh:MOVIE:upcoming', mediaType: 'MOVIE', bucket: 'upcoming',
                staleDays: this.config.upcomingStaleHours / 24, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            await this.runRefreshBucket({
                runId, key: 'refresh:MOVIE:recent', mediaType: 'MOVIE', bucket: 'recent',
                staleDays: this.config.recentStaleDays, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            await this.runRefreshBucket({
                runId, key: 'refresh:MOVIE:stable', mediaType: 'MOVIE', bucket: 'stable',
                staleDays: this.config.stableStaleDays, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            // Refresh buckets — series
            await this.runRefreshBucket({
                runId, key: 'refresh:SERIES:upcoming', mediaType: 'SERIES', bucket: 'upcoming',
                staleDays: this.config.upcomingStaleHours / 24, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            await this.runRefreshBucket({
                runId, key: 'refresh:SERIES:recent', mediaType: 'SERIES', bucket: 'recent',
                staleDays: this.config.recentStaleDays, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            await this.runRefreshBucket({
                runId, key: 'refresh:SERIES:stable', mediaType: 'SERIES', bucket: 'stable',
                staleDays: this.config.stableStaleDays, checkpoint, counts,
                onError: (e) => { lastError = e; },
            });
            // Discovery steps
            for (const feed of DISCOVERY_FEEDS) {
                await this.runDiscoveryFeed({
                    runId, key: `discovery:MOVIE:${feed}`, mediaType: 'MOVIE', feed,
                    checkpoint, counts, onError: (e) => { lastError = e; },
                });
                await this.runDiscoveryFeed({
                    runId, key: `discovery:SERIES:${feed}`, mediaType: 'SERIES', feed,
                    checkpoint, counts, onError: (e) => { lastError = e; },
                });
            }
            await this.db
                .update(catalogRefreshRuns)
                .set({ status: 'COMPLETED', completedAt: new Date(), ...counts, errorMessage: lastError ?? null, checkpoint })
                .where(eq(catalogRefreshRuns.id, runId));
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await this.db
                .update(catalogRefreshRuns)
                .set({ status: 'FAILED', completedAt: new Date(), errorMessage })
                .where(eq(catalogRefreshRuns.id, runId));
        }
    }
    async runRefreshBucket(opts) {
        const { runId, key, mediaType, bucket, staleDays, checkpoint, counts, onError } = opts;
        const stepState = checkpoint[key] ?? { done: false, offset: 0 };
        if (stepState.done)
            return;
        let offset = stepState.offset;
        for (;;) {
            const entities = mediaType === 'MOVIE'
                ? await this.fetchStaleMovies(bucket, staleDays, offset)
                : await this.fetchStaleSeries(bucket, staleDays, offset);
            if (entities.length === 0) {
                checkpoint[key] = { done: true, offset };
                await this.updateRun(runId, { checkpoint });
                break;
            }
            for (const entity of entities) {
                try {
                    const result = mediaType === 'MOVIE'
                        ? await this.enrichmentService.enrichMovie(entity.id, { staleDays })
                        : await this.enrichmentService.enrichSeries(entity.id, { staleDays });
                    if (result === 'enriched') {
                        if (mediaType === 'MOVIE')
                            counts.moviesRefreshed++;
                        else
                            counts.seriesRefreshed++;
                    }
                    else if (result === 'provider-failed') {
                        counts.failedCount++;
                    }
                }
                catch (err) {
                    counts.failedCount++;
                    onError(err instanceof Error ? err.message : String(err));
                }
                await delay(THROTTLE_MS);
            }
            offset += PAGE_SIZE;
            checkpoint[key] = { done: false, offset };
            await this.updateRun(runId, { checkpoint, ...counts });
            if (entities.length < PAGE_SIZE) {
                checkpoint[key] = { done: true, offset };
                await this.updateRun(runId, { checkpoint });
                break;
            }
        }
    }
    async runDiscoveryFeed(opts) {
        const { runId, key, mediaType, feed, checkpoint, counts, onError } = opts;
        const stepState = checkpoint[key] ?? { done: false, offset: 0 };
        if (stepState.done)
            return;
        const startPage = stepState.offset + 1;
        for (let page = startPage; page <= this.config.discoveryMaxPages; page++) {
            let candidates;
            try {
                candidates =
                    mediaType === 'MOVIE'
                        ? await this.provider.fetchMovieFeed(feed, page)
                        : await this.provider.fetchSeriesFeed(feed, page);
            }
            catch (err) {
                counts.failedCount++;
                onError(err instanceof Error ? err.message : String(err));
                await delay(THROTTLE_MS);
                continue;
            }
            if (candidates.length === 0) {
                checkpoint[key] = { done: true, offset: page - 1 };
                await this.updateRun(runId, { checkpoint });
                break;
            }
            try {
                if (mediaType === 'MOVIE') {
                    const { created } = await this.upsertMovieBatch(candidates);
                    counts.moviesImported += created;
                }
                else {
                    const { created } = await this.upsertSeriesBatch(candidates);
                    counts.seriesImported += created;
                }
            }
            catch (err) {
                counts.failedCount++;
                onError(err instanceof Error ? err.message : String(err));
            }
            checkpoint[key] = { done: false, offset: page };
            await this.updateRun(runId, { checkpoint, ...counts });
            await delay(THROTTLE_MS);
            if (page === this.config.discoveryMaxPages) {
                checkpoint[key] = { done: true, offset: page };
                await this.updateRun(runId, { checkpoint });
            }
        }
    }
    async fetchStaleMovies(bucket, staleDays, offset) {
        const staleThreshold = new Date(Date.now() - staleDays * 86_400_000);
        const staleWhere = or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, staleThreshold));
        let bucketWhere;
        if (bucket === 'upcoming') {
            bucketWhere = or(inArray(movies.status, MOVIE_UPCOMING_STATUSES), sql `${movies.theatricalReleaseDate} > CURRENT_DATE - INTERVAL '60 days'`);
        }
        else if (bucket === 'recent') {
            bucketWhere = and(or(isNull(movies.status), sql `${movies.status} NOT IN ('Rumored', 'Planned', 'In Production', 'Post Production')`), sql `${movies.theatricalReleaseDate} > CURRENT_DATE - INTERVAL '90 days'`, sql `${movies.theatricalReleaseDate} <= CURRENT_DATE - INTERVAL '60 days'`);
        }
        else {
            bucketWhere = and(or(isNull(movies.status), sql `${movies.status} NOT IN ('Rumored', 'Planned', 'In Production', 'Post Production')`), or(isNull(movies.theatricalReleaseDate), sql `${movies.theatricalReleaseDate} <= CURRENT_DATE - INTERVAL '90 days'`));
        }
        return this.db
            .select({ id: movies.id })
            .from(movies)
            .where(and(bucketWhere, staleWhere))
            .orderBy(movies.id)
            .limit(PAGE_SIZE)
            .offset(offset);
    }
    async fetchStaleSeries(bucket, staleDays, offset) {
        const staleThreshold = new Date(Date.now() - staleDays * 86_400_000);
        const staleWhere = or(isNull(series.metadataEnrichedAt), lt(series.metadataEnrichedAt, staleThreshold));
        let bucketWhere;
        if (bucket === 'upcoming') {
            bucketWhere = inArray(series.status, SERIES_UPCOMING_STATUSES);
        }
        else if (bucket === 'recent') {
            bucketWhere = and(or(isNull(series.status), sql `${series.status} NOT IN ('In Production', 'Planned')`), sql `${series.theatricalReleaseDate} > CURRENT_DATE - INTERVAL '90 days'`);
        }
        else {
            bucketWhere = and(or(isNull(series.status), sql `${series.status} NOT IN ('In Production', 'Planned')`), or(isNull(series.theatricalReleaseDate), sql `${series.theatricalReleaseDate} <= CURRENT_DATE - INTERVAL '90 days'`));
        }
        return this.db
            .select({ id: series.id })
            .from(series)
            .where(and(bucketWhere, staleWhere))
            .orderBy(series.id)
            .limit(PAGE_SIZE)
            .offset(offset);
    }
    async upsertMovieBatch(candidates) {
        const seen = new Set();
        const values = candidates
            .filter((c) => {
            const id = Number(c.externalId);
            if (!c.externalId || isNaN(id) || seen.has(id))
                return false;
            seen.add(id);
            return true;
        })
            .map((c) => ({
            title: c.title,
            year: c.year,
            synopsis: c.synopsis ?? null,
            posterPath: c.posterPath ?? null,
            tmdbId: Number(c.externalId),
            popularity: c.popularity ?? null,
            voteAverage: c.voteAverage ?? null,
            matchStatus: 'MATCHED',
        }));
        if (values.length === 0)
            return { created: 0, updated: 0 };
        const rows = await this.db
            .insert(movies)
            .values(values)
            .onConflictDoUpdate({
            target: movies.tmdbId,
            set: {
                title: sql `EXCLUDED.title`,
                popularity: sql `EXCLUDED.popularity`,
                updatedAt: sql `now()`,
            },
        })
            .returning({ id: movies.id, isNew: sql `(xmax = 0)` });
        const created = rows.filter((r) => r.isNew).length;
        return { created, updated: rows.length - created };
    }
    async upsertSeriesBatch(candidates) {
        const seen = new Set();
        const values = candidates
            .filter((c) => {
            const id = Number(c.externalId);
            if (!c.externalId || isNaN(id) || seen.has(id))
                return false;
            seen.add(id);
            return true;
        })
            .map((c) => ({
            title: c.title,
            firstAirYear: c.year,
            synopsis: c.synopsis ?? null,
            posterPath: c.posterPath ?? null,
            tmdbId: Number(c.externalId),
            popularity: c.popularity ?? null,
            voteAverage: c.voteAverage ?? null,
            matchStatus: 'MATCHED',
        }));
        if (values.length === 0)
            return { created: 0, updated: 0 };
        const rows = await this.db
            .insert(series)
            .values(values)
            .onConflictDoUpdate({
            target: series.tmdbId,
            set: {
                title: sql `EXCLUDED.title`,
                popularity: sql `EXCLUDED.popularity`,
                updatedAt: sql `now()`,
            },
        })
            .returning({ id: series.id, isNew: sql `(xmax = 0)` });
        const created = rows.filter((r) => r.isNew).length;
        return { created, updated: rows.length - created };
    }
    async updateRun(runId, data) {
        await this.db.update(catalogRefreshRuns).set(data).where(eq(catalogRefreshRuns.id, runId));
    }
    async getLastCompletedRun() {
        const [run] = await this.db
            .select({ completedAt: catalogRefreshRuns.completedAt })
            .from(catalogRefreshRuns)
            .where(eq(catalogRefreshRuns.status, 'COMPLETED'))
            .orderBy(desc(catalogRefreshRuns.completedAt))
            .limit(1);
        return run;
    }
}
//# sourceMappingURL=catalog-refresh-service.js.map