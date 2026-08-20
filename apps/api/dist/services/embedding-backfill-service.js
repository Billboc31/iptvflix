import { asc, and, gt, or, eq, sql } from 'drizzle-orm';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { embeddingEligibleCondition } from './embedding-eligibility.js';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_RETRIES = 3;
async function withRetry(fn, maxRetries, label) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            if (attempt === maxRetries) {
                console.error(`[embedding-backfill] ${label} failed after ${maxRetries} attempts:`, err);
                return null;
            }
            const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 16000);
            await new Promise((r) => setTimeout(r, backoffMs));
        }
    }
    return null;
}
async function processBatch(items, concurrency, handler) {
    const counters = { processed: 0, embedded: 0, skipped: 0, failed: 0 };
    // Simple semaphore-based concurrency
    let active = 0;
    let index = 0;
    await new Promise((resolve, reject) => {
        function next() {
            while (active < concurrency && index < items.length) {
                const item = items[index++];
                active++;
                handler(item)
                    .then((result) => {
                    counters.processed++;
                    counters[result]++;
                })
                    .catch(() => {
                    counters.processed++;
                    counters.failed++;
                })
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
    return counters;
}
function mergeCounters(a, b) {
    return {
        processed: a.processed + b.processed,
        embedded: a.embedded + b.embedded,
        skipped: a.skipped + b.skipped,
        failed: a.failed + b.failed,
    };
}
async function backfillMediaType(db, embeddingService, mediaType, opts) {
    const { batchSize, concurrency, maxRetries } = opts;
    let counters = { processed: 0, embedded: 0, skipped: 0, failed: 0 };
    let cursor = null;
    const table = mediaType === 'MOVIE' ? movies : series;
    while (true) {
        const rows = await (cursor
            ? db
                .select({ id: table.id, createdAt: table.createdAt })
                .from(table)
                .where(and(embeddingEligibleCondition(table.metadataEnrichedAt), or(gt(table.createdAt, cursor.createdAt), and(eq(table.createdAt, cursor.createdAt), sql `${table.id} > ${cursor.id}`))))
                .orderBy(asc(table.createdAt), asc(table.id))
                .limit(batchSize)
            : db
                .select({ id: table.id, createdAt: table.createdAt })
                .from(table)
                .where(embeddingEligibleCondition(table.metadataEnrichedAt))
                .orderBy(asc(table.createdAt), asc(table.id))
                .limit(batchSize));
        if (rows.length === 0)
            break;
        const batchCounters = await processBatch(rows, concurrency, async (row) => {
            const result = await withRetry(() => embeddingService.upsertEmbedding(row.id, mediaType), maxRetries, `${mediaType}:${row.id}`);
            if (!result)
                return 'failed';
            if (result.action === 'embedded')
                return 'embedded';
            if (result.action === 'skipped')
                return 'skipped';
            return 'failed';
        });
        counters = mergeCounters(counters, batchCounters);
        cursor = { createdAt: rows[rows.length - 1].createdAt, id: rows[rows.length - 1].id };
        if (rows.length < batchSize)
            break;
    }
    return counters;
}
export async function runBackfill(db, embeddingService, opts = {}) {
    const resolvedOpts = {
        batchSize: opts.batchSize ?? DEFAULT_BATCH_SIZE,
        concurrency: opts.concurrency ?? DEFAULT_CONCURRENCY,
        maxRetries: opts.maxRetries ?? DEFAULT_MAX_RETRIES,
    };
    const start = Date.now();
    console.log('[embedding-backfill] starting backfill', resolvedOpts);
    const [movieCounters, seriesCounters] = await Promise.all([
        backfillMediaType(db, embeddingService, 'MOVIE', resolvedOpts),
        backfillMediaType(db, embeddingService, 'SERIES', resolvedOpts),
    ]);
    const result = {
        movies: movieCounters,
        series: seriesCounters,
        durationMs: Date.now() - start,
    };
    console.log('[embedding-backfill] completed', result);
    return result;
}
//# sourceMappingURL=embedding-backfill-service.js.map