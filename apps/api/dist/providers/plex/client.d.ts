import type { PlexLibrarySection, PlexMovieItem, PlexShowItem, PlexEpisodeItem } from './types.js';
export declare class PlexClient {
    private readonly baseUrl;
    private readonly token;
    private readonly timeoutMs;
    constructor(baseUrl: string, token: string, timeoutMs?: number);
    private fetch;
    testConnection(): Promise<{
        ok: boolean;
        serverName?: string;
        message?: string;
    }>;
    fetchLibrarySections(): Promise<PlexLibrarySection[]>;
    fetchMovies(sectionKey: string): Promise<PlexMovieItem[]>;
    fetchShows(sectionKey: string): Promise<PlexShowItem[]>;
    fetchEpisodes(sectionKey: string): Promise<PlexEpisodeItem[]>;
}
//# sourceMappingURL=client.d.ts.map