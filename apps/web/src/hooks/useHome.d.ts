import type { ShelfResponse, HeroItem } from '@iptvflix/api-contracts';
export type UseInfiniteHomeResult = {
    allShelves: ShelfResponse[];
    hero: HeroItem | null;
    sessionId: string | null;
    nextCursor: string | null;
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: Error | null;
    loadMore: () => void;
};
export declare function useInfiniteHome(profileId: string, profileVersion: number): UseInfiniteHomeResult;
//# sourceMappingURL=useHome.d.ts.map