import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { MetadataProvider } from '../providers/metadata/types.js';
import type { MetadataEnrichmentService } from './metadata-enrichment-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export declare class CatalogRefreshAlreadyRunningError extends Error {
    constructor();
}
export type ContentBucket = 'upcoming' | 'recent' | 'stable';
export interface RefreshConfig {
    upcomingStaleHours: number;
    recentStaleDays: number;
    stableStaleDays: number;
    discoveryMaxPages: number;
}
export declare function classifyMovieBucket(movie: {
    status: string | null;
    theatricalReleaseDate: string | null;
}, now?: Date): ContentBucket;
export declare function classifySeriesBucket(show: {
    status: string | null;
}): ContentBucket;
export declare class CatalogRefreshService {
    private readonly db;
    private readonly provider;
    private readonly enrichmentService;
    private readonly config;
    constructor(db: Db, provider: MetadataProvider, enrichmentService: MetadataEnrichmentService, config?: Partial<RefreshConfig>);
    run(): Promise<string>;
    private execute;
    private runRefreshBucket;
    private runDiscoveryFeed;
    private fetchStaleMovies;
    private fetchStaleSeries;
    private upsertMovieBatch;
    private upsertSeriesBatch;
    private updateRun;
    getLastCompletedRun(): Promise<{
        completedAt: Date | null;
    } | undefined>;
}
export {};
//# sourceMappingURL=catalog-refresh-service.d.ts.map