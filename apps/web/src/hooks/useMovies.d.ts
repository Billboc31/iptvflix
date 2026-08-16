import type { MovieFilters, PaginatedList, MovieResponse } from '@iptvflix/api-contracts';
export type MoviesState = {
    data: PaginatedList<MovieResponse> | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
};
export declare function useMovies(filters?: MovieFilters): MoviesState;
//# sourceMappingURL=useMovies.d.ts.map