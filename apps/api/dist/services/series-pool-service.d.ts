import type { ShelfResponse } from '@iptvflix/api-contracts';
export declare function getOrCreateSeriesSession(profileId: string): Promise<{
    id: string;
    profileId: string;
    cursorReference: string | null;
}>;
export declare function countUnservedSeries(sessionId: string): Promise<number>;
/** Next verticalPosition for pagination (first unserved shelf, or append after max). */
export declare function resolveSeriesNextServePosition(sessionId: string): Promise<number>;
/** Append position after the highest existing shelf in the session. */
export declare function resolveSeriesAppendPosition(sessionId: string): Promise<number>;
export declare function serveSeriesBatch(sessionId: string, nextPosition: number, batchSize?: number): Promise<{
    shelves: Array<{
        instanceId: string;
        title: string;
        verticalPosition: number;
        items: Array<{
            mediaType: string;
            mediaId: string;
        }>;
    }>;
    newNextPosition: number;
    hasMore: boolean;
}>;
export declare function fillSeriesPool(sessionId: string, profileId: string, targetCount: number): void;
export declare function fillSeriesPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void>;
export declare function buildSeriesDeclaredRails(profileId: string, sessionId: string, startPosition?: number): Promise<{
    shelves: ShelfResponse[];
    nextPoolPosition: number;
    shelfInstanceIds: string[];
}>;
export declare function buildSeriesFallbackShelf(): Promise<ShelfResponse>;
//# sourceMappingURL=series-pool-service.d.ts.map