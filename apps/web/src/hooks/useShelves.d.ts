import type { ShelfSummaryResponse } from '@iptvflix/api-contracts';
export type UseShelvesResult = {
    shelves: ShelfSummaryResponse[];
    loading: boolean;
    error: Error | null;
    refetch: () => void;
};
export declare function useShelves(): UseShelvesResult;
//# sourceMappingURL=useShelves.d.ts.map