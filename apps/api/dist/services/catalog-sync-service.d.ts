import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js';
import type { PlexCatalogSnapshot } from '../providers/plex/types.js';
import type { M3UCatalogSnapshot } from '../providers/m3u/types.js';
import { TitleMatchingService } from './title-matching-service.js';
import type { CanonicalResolver } from './canonical-resolver.js';
export interface CatalogSyncResult {
    runId: string;
    status: 'completed' | 'failed';
    counts: {
        moviesCreated: number;
        moviesUpdated: number;
        seriesCreated: number;
        seriesUpdated: number;
        unavailableCount: number;
        failedCount: number;
        titleMatchedCount: number;
        titleUnmatchedCount: number;
        resolvedCount: number;
        ambiguousCount: number;
        unresolvedCount: number;
    };
    error?: string;
}
export declare class SyncAlreadyRunningError extends Error {
    constructor(sourceId: string);
}
/** Clear stale RUNNING locks and insert a new RUNNING sync_run. */
export declare function acquireSyncRunLock(sourceId: string): Promise<string>;
export declare function failSyncRun(runId: string, errorMessage: string): Promise<void>;
/** Stores a human-readable phase in error_message while the run is still RUNNING. */
export declare function setSyncRunProgress(runId: string, progress: string): Promise<void>;
export declare const CatalogSyncService: {
    syncCatalog(sourceId: string, snapshot: XtreamCatalogSnapshot, options?: {
        runId?: string;
        matchingService?: TitleMatchingService;
        canonicalResolver?: CanonicalResolver;
        skipLifecycle?: boolean;
    }): Promise<CatalogSyncResult>;
    syncPlexCatalog(sourceId: string, snapshot: PlexCatalogSnapshot, options?: {
        runId?: string;
        matchingService?: TitleMatchingService;
        canonicalResolver?: CanonicalResolver;
        skipLifecycle?: boolean;
    }): Promise<CatalogSyncResult>;
    syncM3UCatalog(sourceId: string, snapshot: M3UCatalogSnapshot, options?: {
        runId?: string;
        matchingService?: TitleMatchingService;
        canonicalResolver?: CanonicalResolver;
        skipLifecycle?: boolean;
    }): Promise<CatalogSyncResult>;
};
//# sourceMappingURL=catalog-sync-service.d.ts.map