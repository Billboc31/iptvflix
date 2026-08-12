import type { MetadataProvider, ExternalMovieMetadata, ExternalSeriesMetadata, ExternalVideo, ExternalCreditPerson, MetadataCandidate, DiscoveryFeed } from '../types.js';
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
    getMovieMetadata(tmdbId: number): Promise<ExternalMovieMetadata | null>;
    getSeriesMetadata(tmdbId: number): Promise<ExternalSeriesMetadata | null>;
    getMovieVideos(tmdbId: number): Promise<ExternalVideo[]>;
    getSeriesVideos(tmdbId: number): Promise<ExternalVideo[]>;
    getMovieCredits(tmdbId: number): Promise<ExternalCreditPerson[]>;
    getSeriesCredits(tmdbId: number): Promise<ExternalCreditPerson[]>;
    getMovieCertification(tmdbId: number): Promise<string | null>;
    getSeriesCertification(tmdbId: number): Promise<string | null>;
    searchMovies(query: string, year?: number | null): Promise<MetadataCandidate[]>;
    searchSeries(query: string, year?: number | null): Promise<MetadataCandidate[]>;
    fetchMovieFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>;
    fetchSeriesFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>;
}
//# sourceMappingURL=client.d.ts.map