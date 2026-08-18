import type { MetadataProvider, ExternalMovieMetadata, ExternalSeriesMetadata, ExternalVideo, ExternalCreditPerson, ExternalSeasonEpisode, MetadataCandidate, DiscoveryFeed, DiscoverParams } from '../types.js';
import type { TmdbCollection } from './types.js';
export interface TmdbSimilarItem {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
}
export interface TmdbSimilarResponse {
    results: TmdbSimilarItem[];
}
export declare class TmdbClient implements MetadataProvider {
    private readonly apiKey;
    private readonly timeoutMs;
    constructor(config: {
        apiKey: string;
        timeoutMs?: number;
    });
    private buildHeaders;
    private doFetch;
    private fetchWithRetry;
    getMovieMetadata(tmdbId: number, opts?: {
        language?: string;
    }): Promise<ExternalMovieMetadata | null>;
    getSeriesMetadata(tmdbId: number, opts?: {
        language?: string;
    }): Promise<ExternalSeriesMetadata | null>;
    fetchCollection(collectionTmdbId: number): Promise<TmdbCollection | null>;
    getMovieVideos(tmdbId: number): Promise<ExternalVideo[]>;
    getSeriesVideos(tmdbId: number): Promise<ExternalVideo[]>;
    getMovieCredits(tmdbId: number): Promise<ExternalCreditPerson[]>;
    getSeriesCredits(tmdbId: number): Promise<ExternalCreditPerson[]>;
    getMovieCertification(tmdbId: number): Promise<string | null>;
    getSeriesCertification(tmdbId: number): Promise<string | null>;
    getSeasonEpisodes(tmdbSeriesId: number, seasonNumber: number): Promise<ExternalSeasonEpisode[]>;
    getMovieSimilar(tmdbId: number, page?: number): Promise<TmdbSimilarResponse>;
    getMovieRecommendations(tmdbId: number, page?: number): Promise<TmdbSimilarResponse>;
    getSeriesSimilar(tmdbId: number, page?: number): Promise<TmdbSimilarResponse>;
    getSeriesRecommendations(tmdbId: number, page?: number): Promise<TmdbSimilarResponse>;
    searchMovies(query: string, year?: number | null): Promise<MetadataCandidate[]>;
    searchSeries(query: string, year?: number | null): Promise<MetadataCandidate[]>;
    fetchMovieFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>;
    fetchSeriesFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>;
    fetchMovieTopRated(page: number): Promise<MetadataCandidate[]>;
    fetchSeriesTopRated(page: number): Promise<MetadataCandidate[]>;
    fetchMovieDiscover(discoverParams: DiscoverParams, page: number): Promise<MetadataCandidate[]>;
    getSeriesExternalIds(tmdbSeriesId: number): Promise<{
        imdb_id?: string | null;
    }>;
    fetchSeriesDiscover(discoverParams: DiscoverParams, page: number): Promise<MetadataCandidate[]>;
}
//# sourceMappingURL=client.d.ts.map