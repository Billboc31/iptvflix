import type { ShelfResponse } from '@iptvflix/api-contracts';
export type UseShelfResult = {
    shelf: ShelfResponse | null;
    loading: boolean;
    error: Error | null;
};
export declare function useShelf(id: string): UseShelfResult;
//# sourceMappingURL=useShelf.d.ts.map