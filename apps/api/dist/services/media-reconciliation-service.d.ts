import { TitleMatchingService } from './title-matching-service.js';
export interface ReconcileOptions {
    batchSize?: number;
    concurrency?: number;
    mediaType?: 'MOVIE' | 'SERIES' | 'BOTH';
    dryRun?: boolean;
}
export interface ReconcileResult {
    runId: string;
    status: 'COMPLETED' | 'FAILED';
    processedCount: number;
    matchedCount: number;
    mergedCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
    skippedCount: number;
    failedCount: number;
}
export declare class ReconciliationAlreadyRunningError extends Error {
    constructor(runId: string);
}
export declare class MediaReconciliationService {
    private readonly titleMatchingService;
    constructor(titleMatchingService: TitleMatchingService);
    /** Creates a new RUNNING run row. Throws if one already exists. Returns the runId. */
    startRun(opts?: ReconcileOptions): Promise<string>;
    /** Executes reconciliation for an existing RUNNING run. Intended for fire-and-forget from the route. */
    executeRun(runId: string, opts?: ReconcileOptions): Promise<ReconcileResult>;
    /** Convenience wrapper for tests: starts a run and immediately executes it. */
    reconcile(opts?: ReconcileOptions): Promise<ReconcileResult>;
    private _processType;
    private _fetchPage;
    private _fetchAvailabilities;
    private _reconcileMedia;
    private _migrateMovieData;
    private _migrateSeriesData;
    private _migrateUserState;
}
//# sourceMappingURL=media-reconciliation-service.d.ts.map