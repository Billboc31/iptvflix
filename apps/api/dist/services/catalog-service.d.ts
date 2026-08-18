import type { GenreResponse, MovieFilters, MovieResponse, PaginatedList, SeriesFilters, SeriesResponse } from '@iptvflix/api-contracts';
export { NotFoundError } from './not-found-error.js';
export declare function listMovies(filters: MovieFilters): Promise<PaginatedList<MovieResponse>>;
export declare function getMovie(id: string): Promise<MovieResponse | null>;
export declare function listSeries(filters: SeriesFilters): Promise<PaginatedList<SeriesResponse>>;
export declare function getSeries(id: string): Promise<SeriesResponse | null>;
export declare function searchContent(q: string): Promise<{
    movies: MovieResponse[];
    series: SeriesResponse[];
}>;
export declare function listGenres(): Promise<GenreResponse[]>;
export declare function getMovieTmdbIds(movieIds: string[]): Promise<Set<string>>;
export declare function getSeriesTmdbIds(seriesIds: string[]): Promise<Set<string>>;
//# sourceMappingURL=catalog-service.d.ts.map