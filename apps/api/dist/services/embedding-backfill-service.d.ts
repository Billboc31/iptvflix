import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { EmbeddingService } from './embedding-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface BackfillOpts {
    batchSize?: number;
    concurrency?: number;
    maxRetries?: number;
}
export interface BackfillCounters {
    processed: number;
    embedded: number;
    skipped: number;
    failed: number;
}
export interface BackfillResult {
    movies: BackfillCounters;
    series: BackfillCounters;
    durationMs: number;
}
export declare function runBackfill(db: Db, embeddingService: EmbeddingService, opts?: BackfillOpts): Promise<BackfillResult>;
export {};
//# sourceMappingURL=embedding-backfill-service.d.ts.map