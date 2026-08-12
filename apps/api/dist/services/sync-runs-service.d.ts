import type { SyncRunResponse, TriggerSyncBody } from '@iptvflix/api-contracts';
export declare function withBoundedConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]>;
export declare function listSyncRuns(): Promise<SyncRunResponse[]>;
export declare function triggerSync(body: TriggerSyncBody): Promise<SyncRunResponse>;
//# sourceMappingURL=sync-runs-service.d.ts.map