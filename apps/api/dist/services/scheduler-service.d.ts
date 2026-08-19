import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { TriggerSyncBody } from '@iptvflix/api-contracts';
import type { DiscoveryCandidatePoolService } from './discovery-candidate-pool-service.js';
import { type CatalogRefreshService } from './catalog-refresh-service.js';
import type { SegmentSyncService } from './segment-sync-service.js';
import type { EpisodeBackfillService } from './episode-backfill-service.js';
type Db = PostgresJsDatabase<typeof schema>;
interface SchedulerConfig {
    enabled: boolean;
    sourceSyncCadenceMinutes: number;
    discoveryCadenceMinutes: number;
    sourceSyncConcurrency: number;
    startupDelayMs: number;
    catalogRefreshEnabled?: boolean;
    catalogRefreshCadenceHours?: number;
    segmentRefreshEnabled?: boolean;
    segmentRefreshCadenceHours?: number;
    segmentRefreshRecentDays?: number;
    episodeBackfillCadenceMinutes?: number;
}
export declare class SchedulerService {
    private readonly db;
    private readonly triggerSync;
    private readonly discoveryPoolService;
    private readonly config;
    private readonly catalogRefreshService;
    private readonly segmentSyncService;
    private readonly episodeBackfillService;
    private startupTimer;
    private sourceSyncTimer;
    private discoveryTimer;
    private catalogRefreshTimer;
    private segmentRefreshTimer;
    private episodeBackfillTimer;
    private segmentRefreshTickCount;
    constructor(db: Db, triggerSync: (body: TriggerSyncBody) => Promise<unknown>, discoveryPoolService: DiscoveryCandidatePoolService | null, config: SchedulerConfig, catalogRefreshService?: CatalogRefreshService | null, segmentSyncService?: SegmentSyncService | null, episodeBackfillService?: EpisodeBackfillService | null);
    start(): void;
    stop(): void;
    private runSourceSyncTick;
    private runDiscoveryTick;
    private runCatalogRefreshTick;
    private runEpisodeBackfillTick;
    private runSegmentRefreshTick;
}
export {};
//# sourceMappingURL=scheduler-service.d.ts.map