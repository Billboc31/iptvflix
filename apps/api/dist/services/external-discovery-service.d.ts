import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { MetadataProvider } from '../providers/metadata/types.js';
import type { ExternalMovieCandidate, ExternalSeriesCandidate } from '@iptvflix/api-contracts';
type Db = PostgresJsDatabase<typeof schema>;
export declare class ExternalDiscoveryService {
    private readonly db;
    private readonly provider;
    private readonly movieQueryCache;
    private readonly seriesQueryCache;
    constructor(db: Db, provider: MetadataProvider);
    discoverMovies(query: string, excludeTmdbIds: Set<string>): Promise<ExternalMovieCandidate[]>;
    discoverSeries(query: string, excludeTmdbIds: Set<string>): Promise<ExternalSeriesCandidate[]>;
    materializeMovie(tmdbId: string): Promise<{
        id: string;
    }>;
    materializeSeries(tmdbId: string): Promise<{
        id: string;
    }>;
}
export {};
//# sourceMappingURL=external-discovery-service.d.ts.map