import type { ShelfResponse } from '@iptvflix/api-contracts';
export type UseInfiniteSeriesPageResult = {
    allShelves: ShelfResponse[];
    sessionId: string | null;
    nextCursor: string | null;
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: Error | null;
    loadMore: () => void;
};
export declare function useInfiniteSeriesPage(profileId: string, profileVersion: number): UseInfiniteSeriesPageResult;
//# sourceMappingURL=useSeriesPage.d.ts.map