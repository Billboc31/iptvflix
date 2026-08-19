import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { MetadataProvider, DiscoveryFeed } from '../providers/metadata/types.js';
import type { MetadataEnrichmentService } from './metadata-enrichment-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export declare class BootstrapAlreadyRunningError extends Error {
    constructor();
}
export type BootstrapStep = {
    kind: 'feed';
    mediaType: 'MOVIE' | 'SERIES';
    feed: DiscoveryFeed | 'top_rated';
    maxPages: number;
} | {
    kind: 'genre';
    mediaType: 'MOVIE' | 'SERIES';
    genreId: number;
    maxPages: number;
} | {
    kind: 'language';
    mediaType: 'MOVIE' | 'SERIES';
    language: string;
    maxPages: number;
};
export interface BootstrapConfig {
    maxPagesPerFeed: number;
    maxPagesTopRated: number;
    maxPagesPerGenre: number;
    maxPagesFrench: number;
    maxPagesNowPlaying: number;
    movieGenreIds: number[];
    tvGenreIds: number[];
    hierarchyPriorityCount: number;
    /** Minimum vote count applied as quality gate on genre/discover steps. */
    qualityMinVoteCount: number;
    /** Minimum popularity score applied as quality gate on genre/discover steps. */
    qualityMinPopularity: number;
}
export declare class CatalogBootstrapService {
    private readonly db;
    private readonly provider;
    private readonly enrichmentService?;
    private readonly config;
    constructor(db: Db, provider: MetadataProvider, config?: Partial<BootstrapConfig>, enrichmentService?: MetadataEnrichmentService | undefined);
    static buildSteps(config: BootstrapConfig): BootstrapStep[];
    start(): Promise<string>;
    private execute;
    private fetchPage;
    private upsertMovieBatch;
    private upsertSeriesBatch;
    private updateRun;
}
export {};
//# sourceMappingURL=catalog-bootstrap-service.d.ts.map