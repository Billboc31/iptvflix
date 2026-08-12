import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js';
import type { PlexCatalogSnapshot } from '../providers/plex/types.js';
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
    };
    error?: string;
}
export declare class SyncAlreadyRunningError extends Error {
    constructor(sourceId: string);
}
export declare const CatalogSyncService: {
    syncCatalog(sourceId: string, snapshot: XtreamCatalogSnapshot): Promise<CatalogSyncResult>;
    syncPlexCatalog(sourceId: string, snapshot: PlexCatalogSnapshot): Promise<CatalogSyncResult>;
};
//# sourceMappingURL=catalog-sync-service.d.ts.map