import type { MovieDetailResponse, SeriesDetailResponse, EpisodeResponse, MovieResponse, SeriesResponse, GenreResponse, SourceResponse, SyncRunResponse, WatchlistEntry, ContinueWatchingItem, ShelfSummaryResponse, ShelfResponse, DeviceResponse, PairingCodeDetailResponse, PlaybackCommandResponse } from '@iptvflix/api-contracts';
export declare const MOCK_SIMILAR_MOVIE: MovieResponse;
export declare const MOCK_SIMILAR_SERIES: SeriesResponse;
export declare const MOCK_MOVIE: MovieDetailResponse;
export declare const MOCK_MOVIE_NO_TRAILER: MovieDetailResponse;
export declare const MOCK_PROFILE_PREFERENCES: {
    preferredAudioLanguages: string[];
    preferredSubtitleLanguages: string[];
    preferredSourceIds: string[];
    maxVideoQuality: string | null;
    autoplayPreviews: boolean;
};
export declare const MOCK_UNMATCHED_MOVIE: MovieDetailResponse;
export declare const MOCK_SERIES: SeriesDetailResponse;
export declare const MOCK_EPISODES: EpisodeResponse[];
export declare const MOCK_SOURCE: SourceResponse;
export declare const MOCK_GENRES: GenreResponse[];
export declare const MOCK_WATCHLIST_ENTRY: WatchlistEntry;
export declare const MOCK_CONTINUE_WATCHING: ContinueWatchingItem;
export declare const MOCK_SHELF_SUMMARY: ShelfSummaryResponse;
export declare const MOCK_SHELF: ShelfResponse;
export declare const MOCK_DEVICE_ONLINE: DeviceResponse;
export declare const MOCK_DEVICE_OFFLINE: DeviceResponse;
export declare const MOCK_PAIRING_CODE_DETAIL: PairingCodeDetailResponse;
export declare const MOCK_PLAY_COMMAND: PlaybackCommandResponse;
export declare const MOCK_SYNC_RUN: SyncRunResponse;
export declare const handlers: import("msw").HttpHandler[];
export declare const server: import("msw/node").SetupServer;
//# sourceMappingURL=handlers.d.ts.map