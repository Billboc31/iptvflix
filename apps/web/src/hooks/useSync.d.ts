import type { SyncRunResponse } from '@iptvflix/api-contracts';
export type SyncState = {
    runs: SyncRunResponse[] | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
    triggerSync: (sourceId: string) => Promise<SyncRunResponse>;
};
export declare function useSync(): SyncState;
//# sourceMappingURL=useSync.d.ts.map