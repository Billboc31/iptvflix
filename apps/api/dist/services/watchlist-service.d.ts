import type { WatchlistMediaType, WatchlistEntry } from '@iptvflix/api-contracts';
export declare function addToWatchlist(profileId: string, mediaType: WatchlistMediaType, mediaId: string): Promise<WatchlistEntry>;
export declare function removeFromWatchlist(profileId: string, mediaType: WatchlistMediaType, mediaId: string): Promise<void>;
export declare function listWatchlist(profileId: string): Promise<WatchlistEntry[]>;
//# sourceMappingURL=watchlist-service.d.ts.map