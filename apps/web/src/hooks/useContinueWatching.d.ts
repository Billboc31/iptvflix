import type { ContinueWatchingItem } from '@iptvflix/api-contracts';
export type UseContinueWatchingResult = {
    items: ContinueWatchingItem[];
    loading: boolean;
    error: Error | null;
};
export declare function useContinueWatching(): UseContinueWatchingResult;
//# sourceMappingURL=useContinueWatching.d.ts.map