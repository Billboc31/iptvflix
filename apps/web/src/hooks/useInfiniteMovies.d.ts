import type { ShelfResponse } from '@iptvflix/api-contracts';
export type UseInfiniteMoviesResult = {
    allShelves: ShelfResponse[];
    sessionId: string | null;
    nextCursor: string | null;
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: Error | null;
    loadMore: () => void;
};
export declare function useInfiniteMovies(profileId: string, profileVersion: number): UseInfiniteMoviesResult;
//# sourceMappingURL=useInfiniteMovies.d.ts.map