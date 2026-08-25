import type { ArrivalItem } from '@iptvflix/api-contracts';
export type UseArrivalsResult = {
    arrivals: ArrivalItem[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => void;
};
export declare function useArrivals(filter?: 'unread' | 'all'): UseArrivalsResult;
//# sourceMappingURL=useArrivals.d.ts.map