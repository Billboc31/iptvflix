export interface PlexLibrarySection {
    key: string;
    title: string;
    type: 'movie' | 'show';
}
export interface PlexGuid {
    id: string;
}
export interface PlexMovieItem {
    ratingKey: string;
    title: string;
    year?: number;
    thumb?: string;
    summary?: string;
    Guid?: PlexGuid[];
}
export interface PlexShowItem {
    ratingKey: string;
    title: string;
    year?: number;
    thumb?: string;
    summary?: string;
    Guid?: PlexGuid[];
}
export interface PlexEpisodeItem {
    ratingKey: string;
    grandparentRatingKey: string;
    parentIndex: number;
    index: number;
    title: string;
    summary?: string;
    duration?: number;
    originallyAvailableAt?: string;
}
export interface PlexCatalogSnapshot {
    sourceId: string;
    fetchedAt: Date;
    movies: PlexMovieItem[];
    shows: PlexShowItem[];
    episodes: PlexEpisodeItem[];
}
//# sourceMappingURL=types.d.ts.map