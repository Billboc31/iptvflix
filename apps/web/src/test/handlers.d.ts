import type { MovieDetailResponse, SeriesDetailResponse, EpisodeResponse, GenreResponse, SourceResponse, SyncRunResponse, WatchlistEntry, ContinueWatchingItem, ShelfSummaryResponse, ShelfResponse } from '@iptvflix/api-contracts';
export declare const MOCK_MOVIE: MovieDetailResponse;
export declare const MOCK_MOVIE_NO_TRAILER: MovieDetailResponse;
export declare const MOCK_UNMATCHED_MOVIE: MovieDetailResponse;
export declare const MOCK_SERIES: SeriesDetailResponse;
export declare const MOCK_EPISODES: EpisodeResponse[];
export declare const MOCK_SOURCE: SourceResponse;
export declare const MOCK_GENRES: GenreResponse[];
export declare const MOCK_WATCHLIST_ENTRY: WatchlistEntry;
export declare const MOCK_CONTINUE_WATCHING: ContinueWatchingItem;
export declare const MOCK_SHELF_SUMMARY: ShelfSummaryResponse;
export declare const MOCK_SHELF: ShelfResponse;
export declare const MOCK_SYNC_RUN: SyncRunResponse;
export declare const handlers: import("msw").HttpHandler[];
export declare const server: import("msw/node").SetupServer;
//# sourceMappingURL=handlers.d.ts.map