export declare const DOCUMENT_VERSION = "v1";
export type MediaType = 'MOVIE' | 'SERIES';
export interface Genre {
    name: string;
}
export interface MediaCredit {
    role: string;
    name: string;
    creditOrder: number;
}
export interface MovieFields {
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    synopsis?: string | null;
    keywords?: string[] | null;
    originalLanguage?: string | null;
    durationMinutes?: number | null;
    voteAverage?: number | null;
    popularity?: number | null;
    certification?: string | null;
    collectionName?: string | null;
}
export interface SeriesFields {
    title: string;
    originalTitle?: string | null;
    firstAirYear?: number | null;
    synopsis?: string | null;
    keywords?: string[] | null;
    originalLanguage?: string | null;
    numberOfSeasons?: number | null;
    numberOfEpisodes?: number | null;
    voteAverage?: number | null;
    popularity?: number | null;
    certification?: string | null;
}
export interface EmbeddingDocument {
    text: string;
    version: string;
    mediaType: MediaType;
}
export interface CoverageReport {
    hasTitle: boolean;
    hasOverview: boolean;
    hasGenres: boolean;
    hasKeywords: boolean;
    hasCredits: boolean;
    hasLanguage: boolean;
    hasYear: boolean;
    richFieldCount: number;
}
export declare function buildMovieEmbeddingDocument(movie: MovieFields, genres: Genre[], credits: MediaCredit[]): EmbeddingDocument;
export declare function buildSeriesEmbeddingDocument(series: SeriesFields, genres: Genre[], credits: MediaCredit[]): EmbeddingDocument;
export declare function hashDocument(doc: EmbeddingDocument): string;
export declare function measureCoverage(media: MovieFields | SeriesFields, genres: Genre[], credits: MediaCredit[]): CoverageReport;
//# sourceMappingURL=embedding-document-builder.d.ts.map