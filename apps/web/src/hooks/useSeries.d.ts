import type { SeriesFilters, PaginatedList, SeriesResponse } from '@iptvflix/api-contracts';
export type SeriesState = {
    data: PaginatedList<SeriesResponse> | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
};
export declare function useSeries(filters?: SeriesFilters): SeriesState;
//# sourceMappingURL=useSeries.d.ts.map