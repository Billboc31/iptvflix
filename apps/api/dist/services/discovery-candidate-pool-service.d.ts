import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { DiscoveryFeed, MetadataProvider } from '../providers/metadata/types.js';
import type { ExternalDiscoveryService } from './external-discovery-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export declare class DiscoveryCandidatePoolService {
    private readonly db;
    private readonly provider;
    private readonly externalDiscovery;
    constructor(db: Db, provider: MetadataProvider, externalDiscovery: ExternalDiscoveryService);
    refreshPool(feeds: DiscoveryFeed[], mediaTypes: ('MOVIE' | 'SERIES')[]): Promise<void>;
    private refreshFeedType;
    private crossReferenceCanonicals;
    evictStale(): Promise<number>;
    materializeCandidate(candidateId: string): Promise<{
        movie: {
            id: string;
        };
    } | {
        series: {
            id: string;
        };
    }>;
}
export {};
//# sourceMappingURL=discovery-candidate-pool-service.d.ts.map