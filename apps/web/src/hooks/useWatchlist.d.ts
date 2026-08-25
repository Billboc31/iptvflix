import type { WatchlistEntry, WatchlistMediaType } from '@iptvflix/api-contracts';
export type UseWatchlistResult = {
    entries: WatchlistEntry[];
    loading: boolean;
    add: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>;
    remove: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>;
};
export declare function useWatchlist(): UseWatchlistResult;
//# sourceMappingURL=useWatchlist.d.ts.map