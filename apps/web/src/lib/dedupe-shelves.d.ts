import type { ShelfResponse } from '@iptvflix/api-contracts';
/** Append shelves without duplicating ids already present. */
export declare function mergeShelves(prev: ShelfResponse[], incoming: ShelfResponse[]): ShelfResponse[];
/** Remove duplicate shelf ids within a single page response. */
export declare function dedupeShelves(shelves: ShelfResponse[]): ShelfResponse[];
//# sourceMappingURL=dedupe-shelves.d.ts.map