import type { MovieResponse, MovieDetailResponse, SeriesResponse, GenreResponse, SeriesDetailResponse, EpisodeResponse, PaginatedList, MovieFilters, SeriesFilters, SearchResponse, SourceResponse, CreateSourceBody, UpdateSourceBody, TestSourceResult, SyncRunResponse, TriggerSyncBody, WatchlistEntry, AddToWatchlistBody, WatchlistMediaType, ViewingProgressRow, UpsertProgressBody, ProgressMediaType, ContinueWatchingItem, ShelfSummaryResponse, ShelfResponse, CreateShelfBody, UpdateShelfBody, AddShelfMemberBody, ReorderShelfMembersBody, GenerateShelfBody, GenerateShelfResponse, ProfileResponse, UpdateProfilePreferencesBody, FeedbackItem, SetFeedbackBody, HomeResponse } from '@iptvflix/api-contracts';
export declare class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function listMovies(filters?: MovieFilters): Promise<PaginatedList<MovieResponse>>;
export declare function getMovie(id: string): Promise<MovieDetailResponse>;
export declare function listSeries(filters?: SeriesFilters): Promise<PaginatedList<SeriesResponse>>;
export declare function getSeries(id: string): Promise<SeriesDetailResponse>;
export declare function getSeriesSeasonEpisodes(seriesId: string, seasonNumber: number, profileId?: string): Promise<EpisodeResponse[]>;
export declare function searchContent(q: string): Promise<SearchResponse>;
export declare function materializeMovie(tmdbId: string): Promise<{
    id: string;
}>;
export declare function materializeSeries(tmdbId: string): Promise<{
    id: string;
}>;
export declare function listGenres(): Promise<GenreResponse[]>;
export declare function listSources(): Promise<SourceResponse[]>;
export declare function createSource(body: CreateSourceBody): Promise<SourceResponse>;
export declare function updateSource(id: string, body: UpdateSourceBody): Promise<SourceResponse>;
export declare function deleteSource(id: string): Promise<void>;
export declare function testSource(id: string): Promise<TestSourceResult>;
export declare function listSyncRuns(): Promise<SyncRunResponse[]>;
export declare function triggerSync(body: TriggerSyncBody): Promise<SyncRunResponse>;
export declare function fetchWatchlist(): Promise<WatchlistEntry[]>;
export declare function addToWatchlist(body: AddToWatchlistBody): Promise<WatchlistEntry>;
export declare function removeFromWatchlist(mediaType: WatchlistMediaType, mediaId: string): Promise<void>;
export declare function upsertProgress(mediaType: ProgressMediaType, mediaId: string, body: UpsertProgressBody): Promise<ViewingProgressRow>;
export declare function fetchContinueWatching(): Promise<ContinueWatchingItem[]>;
export declare function fetchShelves(): Promise<ShelfSummaryResponse[]>;
export declare function fetchShelf(id: string): Promise<ShelfResponse>;
export declare function createShelf(body: CreateShelfBody): Promise<ShelfSummaryResponse>;
export declare function updateShelf(id: string, body: UpdateShelfBody): Promise<ShelfSummaryResponse>;
export declare function deleteShelf(id: string): Promise<void>;
export declare function addShelfMember(id: string, body: AddShelfMemberBody): Promise<void>;
export declare function removeShelfMember(id: string, mediaType: 'MOVIE' | 'SERIES', mediaId: string): Promise<void>;
export declare function reorderShelfMembers(id: string, body: ReorderShelfMembersBody): Promise<void>;
export declare function generateShelf(body: GenerateShelfBody): Promise<GenerateShelfResponse>;
export declare function refreshShelf(id: string): Promise<GenerateShelfResponse>;
export declare function getProfile(): Promise<ProfileResponse>;
export declare function updateProfilePreferences(body: UpdateProfilePreferencesBody): Promise<ProfileResponse>;
export declare function fetchFeedback(): Promise<FeedbackItem[]>;
export declare function setFeedback(mediaType: WatchlistMediaType, mediaId: string, body: SetFeedbackBody): Promise<FeedbackItem>;
export declare function clearFeedback(mediaType: WatchlistMediaType, mediaId: string): Promise<void>;
export declare function fetchHome(profileId: string): Promise<HomeResponse>;
//# sourceMappingURL=api.d.ts.map