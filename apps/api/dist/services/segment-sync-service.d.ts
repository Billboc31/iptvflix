import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { RawSegment, SegmentProvider } from '../providers/segments/types.js';
import type { TmdbClient } from '../providers/metadata/tmdb/client.js';
import { type MergedSegment } from './segment-merger.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface SyncCounters {
    found: number;
    noData: number;
    errors: number;
    mismatches: number;
}
export interface BackfillOptions {
    concurrency: number;
    dryRun?: boolean;
    force?: boolean;
}
export interface BackfillResult extends SyncCounters {
    total: number;
    processed: number;
}
export declare class SegmentSyncService {
    private readonly db;
    private readonly tmdbClient;
    private readonly providers;
    private readonly providerPriority;
    constructor(db: Db, tmdbClient: TmdbClient, providers: SegmentProvider[], providerPriority?: string[]);
    upsertSegments(episodeId: string, segments: RawSegment[]): Promise<void>;
    upsertSelections(episodeId: string, selections: MergedSegment[]): Promise<void>;
    syncEpisode(episodeId: string, seriesId: string, seasonNumber: number, episodeNumber: number): Promise<SyncCounters>;
    syncEpisodeById(episodeId: string): Promise<SyncCounters>;
    backfillCatalog(opts: BackfillOptions): Promise<BackfillResult>;
    private filterUnsynced;
    private printProgress;
}
export {};
//# sourceMappingURL=segment-sync-service.d.ts.map