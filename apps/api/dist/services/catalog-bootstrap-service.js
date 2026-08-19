import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { catalogBootstrapRuns } from '../db/schema/catalog-bootstrap-runs.js';
import { CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED, CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED, CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE, CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH, CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING, CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE, CATALOG_BOOTSTRAP_GENRE_IDS_TV, CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT, CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT, CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY, } from '../config/env.js';
const THROTTLE_MS = 250;
export class BootstrapAlreadyRunningError extends Error {
    constructor() {
        super('A catalog bootstrap run is already in progress');
        this.name = 'BootstrapAlreadyRunningError';
    }
}
function stepKey(step) {
    if (step.kind === 'feed')
        return `feed:${step.mediaType}:${step.feed}`;
    if (step.kind === 'genre')
        return `genre:${step.mediaType}:${step.genreId}`;
    return `language:${step.mediaType}:${step.language}`;
}
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export class CatalogBootstrapService {
    db;
    provider;
    enrichmentService;
    config;
    constructor(db, provider, config, enrichmentService) {
        this.db = db;
        this.provider = provider;
        this.enrichmentService = enrichmentService;
        this.config = {
            maxPagesPerFeed: CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED,
            maxPagesTopRated: CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED,
            maxPagesPerGenre: CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE,
            maxPagesFrench: CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH,
            maxPagesNowPlaying: CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING,
            movieGenreIds: CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE,
            tvGenreIds: CATALOG_BOOTSTRAP_GENRE_IDS_TV,
            hierarchyPriorityCount: CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT,
            qualityMinVoteCount: CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT,
            qualityMinPopularity: CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY,
            ...config,
        };
    }
    static buildSteps(config) {
        const steps = [];
        for (const feed of ['popular', 'trending', 'upcoming']) {
            steps.push({ kind: 'feed', mediaType: 'MOVIE', feed, maxPages: config.maxPagesPerFeed });
        }
        steps.push({ kind: 'feed', mediaType: 'MOVIE', feed: 'now_playing', maxPages: config.maxPagesNowPlaying });
        steps.push({ kind: 'feed', mediaType: 'MOVIE', feed: 'top_rated', maxPages: config.maxPagesTopRated });
        for (const feed of ['popular', 'trending', 'upcoming']) {
            steps.push({ kind: 'feed', mediaType: 'SERIES', feed, maxPages: config.maxPagesPerFeed });
        }
        steps.push({ kind: 'feed', mediaType: 'SERIES', feed: 'airing_today', maxPages: config.maxPagesNowPlaying });
        steps.push({ kind: 'feed', mediaType: 'SERIES', feed: 'top_rated', maxPages: config.maxPagesTopRated });
        for (const genreId of config.movieGenreIds) {
            steps.push({ kind: 'genre', mediaType: 'MOVIE', genreId, maxPages: config.maxPagesPerGenre });
        }
        for (const genreId of config.tvGenreIds) {
            steps.push({ kind: 'genre', mediaType: 'SERIES', genreId, maxPages: config.maxPagesPerGenre });
        }
        steps.push({ kind: 'language', mediaType: 'MOVIE', language: 'fr', maxPages: config.maxPagesFrench });
        steps.push({ kind: 'language', mediaType: 'SERIES', language: 'fr', maxPages: config.maxPagesFrench });
        return steps;
    }
    async start() {
        const running = await this.db
            .select({ id: catalogBootstrapRuns.id })
            .from(catalogBootstrapRuns)
            .where(eq(catalogBootstrapRuns.status, 'RUNNING'))
            .limit(1);
        if (running.length > 0)
            throw new BootstrapAlreadyRunningError();
        const [run] = await this.db
            .insert(catalogBootstrapRuns)
            .values({ status: 'RUNNING' })
            .returning({ id: catalogBootstrapRuns.id });
        void this.execute(run.id);
        return run.id;
    }
    async execute(runId) {
        try {
            const [run] = await this.db
                .select({ checkpoint: catalogBootstrapRuns.checkpoint })
                .from(catalogBootstrapRuns)
                .where(eq(catalogBootstrapRuns.id, runId));
            const checkpoint = run?.checkpoint ?? {};
            const steps = CatalogBootstrapService.buildSteps(this.config);
            const counts = {
                moviesCreated: 0,
                moviesUpdated: 0,
                seriesCreated: 0,
                seriesUpdated: 0,
                failedCount: 0,
            };
            let lastError;
            for (const step of steps) {
                const key = stepKey(step);
                const stepState = checkpoint[key] ?? { done: false, lastPage: 0 };
                if (stepState.done)
                    continue;
                const startPage = stepState.lastPage + 1;
                for (let page = startPage; page <= step.maxPages; page++) {
                    let candidates;
                    try {
                        candidates = await this.fetchPage(step, page);
                    }
                    catch (err) {
                        counts.failedCount++;
                        lastError = err instanceof Error ? err.message : String(err);
                        await this.updateRun(runId, { ...counts, errorMessage: lastError, checkpoint });
                        await delay(THROTTLE_MS);
                        continue;
                    }
                    if (candidates.length === 0)
                        break;
                    // Quality floor: skip low-signal results on deep discover/genre/language pages.
                    // Feed steps are exempt because their results are already curated by TMDB.
                    const batch = step.kind !== 'feed'
                        ? candidates.filter((c) => (c.voteCount ?? 0) >= this.config.qualityMinVoteCount &&
                            (c.popularity ?? 0) >= this.config.qualityMinPopularity)
                        : candidates;
                    try {
                        if (step.mediaType === 'MOVIE') {
                            const { created, updated } = await this.upsertMovieBatch(batch);
                            counts.moviesCreated += created;
                            counts.moviesUpdated += updated;
                        }
                        else {
                            const { created, updated } = await this.upsertSeriesBatch(batch);
                            counts.seriesCreated += created;
                            counts.seriesUpdated += updated;
                        }
                    }
                    catch {
                        counts.failedCount++;
                    }
                    checkpoint[key] = { done: false, lastPage: page };
                    await this.updateRun(runId, { ...counts, errorMessage: lastError, checkpoint });
                    await delay(THROTTLE_MS);
                }
                checkpoint[key] = { done: true, lastPage: step.maxPages };
                await this.updateRun(runId, { checkpoint });
            }
            // Priority hierarchy hydration: enrich top-N series by popularity so canonical
            // season/episode rows exist before any source import. Remaining shows are picked
            // up by the refresh scheduler on its first cycle (metadataEnrichedAt IS NULL).
            const hierarchyKey = 'hierarchy:priority';
            if (!checkpoint[hierarchyKey]?.done && this.enrichmentService) {
                const priorityCount = this.config.hierarchyPriorityCount;
                console.log(`[bootstrap] Starting priority hierarchy hydration for top ${priorityCount} series`);
                const prioritySeries = await this.db
                    .select({ id: series.id })
                    .from(series)
                    .where(isNotNull(series.tmdbId))
                    .orderBy(desc(series.popularity))
                    .limit(priorityCount);
                let hierarchyEnriched = 0;
                let hierarchyFailed = 0;
                const HIERARCHY_BATCH_SIZE = 5;
                const HIERARCHY_BATCH_DELAY_MS = 500;
                for (let i = 0; i < prioritySeries.length; i += HIERARCHY_BATCH_SIZE) {
                    const batch = prioritySeries.slice(i, i + HIERARCHY_BATCH_SIZE);
                    await Promise.all(batch.map(async (s) => {
                        try {
                            await this.enrichmentService.enrichSeries(s.id);
                            hierarchyEnriched++;
                        }
                        catch {
                            hierarchyFailed++;
                        }
                    }));
                    if (i + HIERARCHY_BATCH_SIZE < prioritySeries.length) {
                        await delay(HIERARCHY_BATCH_DELAY_MS);
                    }
                }
                console.log(`[bootstrap] Priority hierarchy hydration complete: enriched=${hierarchyEnriched}, failed=${hierarchyFailed}`);
                checkpoint[hierarchyKey] = { done: true, lastPage: 0 };
                await this.updateRun(runId, { checkpoint });
            }
            await this.db
                .update(catalogBootstrapRuns)
                .set({
                status: 'COMPLETED',
                completedAt: new Date(),
                ...counts,
                errorMessage: lastError ?? null,
                checkpoint,
            })
                .where(eq(catalogBootstrapRuns.id, runId));
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await this.db
                .update(catalogBootstrapRuns)
                .set({ status: 'FAILED', completedAt: new Date(), errorMessage })
                .where(eq(catalogBootstrapRuns.id, runId));
        }
    }
    async fetchPage(step, page) {
        if (step.kind === 'feed') {
            if (step.feed === 'top_rated') {
                return step.mediaType === 'MOVIE'
                    ? this.provider.fetchMovieTopRated(page)
                    : this.provider.fetchSeriesTopRated(page);
            }
            return step.mediaType === 'MOVIE'
                ? this.provider.fetchMovieFeed(step.feed, page)
                : this.provider.fetchSeriesFeed(step.feed, page);
        }
        const discoverParams = step.kind === 'genre'
            ? { genreId: step.genreId }
            : { language: step.language };
        return step.mediaType === 'MOVIE'
            ? this.provider.fetchMovieDiscover(discoverParams, page)
            : this.provider.fetchSeriesDiscover(discoverParams, page);
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
        await this.db
            .update(catalogBootstrapRuns)
            .set(data)
            .where(eq(catalogBootstrapRuns.id, runId));
    }
}
//# sourceMappingURL=catalog-bootstrap-service.js.map