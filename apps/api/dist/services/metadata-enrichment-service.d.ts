import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { MetadataProvider } from '../providers/metadata/types.js';
type Db = PostgresJsDatabase<typeof schema>;
export type EnrichResult = 'enriched' | 'skipped' | 'no-tmdb-id' | 'provider-failed';
export interface EnrichmentCounters {
    enriched: number;
    skipped: number;
    failed: number;
}
export interface EnrichPendingResult {
    movies: EnrichmentCounters;
    series: EnrichmentCounters;
}
export declare class MetadataEnrichmentService {
    private readonly db;
    private readonly provider;
    private readonly staleDays;
    constructor(db: Db, provider: MetadataProvider, staleDays?: number);
    enrichMovie(movieId: string, opts?: {
        force?: boolean;
        staleDays?: number;
    }): Promise<EnrichResult>;
    enrichSeries(seriesId: string, opts?: {
        force?: boolean;
        staleDays?: number;
    }): Promise<EnrichResult>;
    enrichPending(opts?: {
        staleDays?: number;
        force?: boolean;
    }): Promise<EnrichPendingResult>;
    private persistVideos;
    private persistCredits;
    private upsertGenres;
}
export {};
//# sourceMappingURL=metadata-enrichment-service.d.ts.map