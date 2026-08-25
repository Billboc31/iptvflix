import type { ContinueWatchingItem, ProgressMediaType } from '@iptvflix/api-contracts';
export type UseContinueWatchingResult = {
    items: ContinueWatchingItem[];
    loading: boolean;
    error: Error | null;
    dismissItem: (mediaType: ProgressMediaType, mediaId: string) => Promise<void>;
    dismissError: string | null;
    dismissErrorFor: string | null;
};
export declare function useContinueWatching(): UseContinueWatchingResult;
//# sourceMappingURL=useContinueWatching.d.ts.map