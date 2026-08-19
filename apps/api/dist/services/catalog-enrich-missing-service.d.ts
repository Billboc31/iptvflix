import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import { enrichmentFailures } from '../db/schema/enrichment-failures.js';
import type { MetadataEnrichmentService } from './metadata-enrichment-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface EnrichMissingOptions {
    mediaTypes?: ('MOVIE' | 'SERIES')[];
    batchSize?: number;
    concurrency?: number;
    throttleMs?: number;
    force?: boolean;
}
export interface EnrichMissingStats {
    totalEligible: number;
    processed: number;
    enriched: number;
    skipped: number;
    retrying: number;
    failedTerminal: number;
    remaining: number;
    ratePerMinute: number;
    etaSeconds: number | null;
}
export declare class CatalogEnrichMissingService {
    private readonly db;
    private readonly enrichmentService;
    constructor(db: Db, enrichmentService: MetadataEnrichmentService);
    private checkNoRunningConflict;
    private enrichWithRetry;
    countEligible(mediaType: 'MOVIE' | 'SERIES', force: boolean): Promise<number>;
    start(opts?: EnrichMissingOptions): Promise<string>;
    private execute;
    getLatestRunStatus(): Promise<{
        runId: string;
        status: string;
        startedAt: Date;
        completedAt: Date | null;
        stats: EnrichMissingStats | null;
    } | null>;
    listFailures(opts: {
        page: number;
        limit: number;
        mediaType?: string;
        retryable?: boolean;
    }): Promise<{
        rows: (typeof enrichmentFailures.$inferSelect)[];
        total: number;
    }>;
    retryFailures(opts?: {
        mediaType?: string;
        ids?: string[];
        concurrency?: number;
        force?: boolean;
    }): Promise<{
        runId: string;
        queued: number;
    }>;
}
export {};
//# sourceMappingURL=catalog-enrich-missing-service.d.ts.map