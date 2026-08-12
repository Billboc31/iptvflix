import type { HomeResponse } from '@iptvflix/api-contracts';
export type UseHomeResult = {
    data: HomeResponse | undefined;
    isLoading: boolean;
    error: Error | null;
};
export declare function useHome(profileId: string): UseHomeResult;
//# sourceMappingURL=useHome.d.ts.map