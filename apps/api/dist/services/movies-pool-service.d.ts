import type { ShelfResponse } from '@iptvflix/api-contracts';
export declare function getOrCreateMoviesSession(profileId: string): Promise<{
    id: string;
    profileId: string;
    cursorReference: string | null;
}>;
export declare function getMoviesSessionById(sessionId: string): Promise<{
    id: string;
    profileId: string;
    cursorReference: string | null;
} | null>;
export declare function countMoviesUnserved(sessionId: string): Promise<number>;
/** Next verticalPosition for pagination (first unserved shelf, or append after max). */
export declare function resolveMoviesNextServePosition(sessionId: string): Promise<number>;
/** Append position after the highest existing shelf in the session. */
export declare function resolveMoviesAppendPosition(sessionId: string): Promise<number>;
export declare function serveMoviesBatch(sessionId: string, nextPosition: number, batchSize?: number): Promise<{
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
export declare function fillMoviesPool(sessionId: string, profileId: string, targetCount: number): void;
export declare function fillMoviesPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void>;
export declare function buildMoviesDeclaredRails(profileId: string, sessionId: string, startPosition?: number): Promise<{
    shelves: ShelfResponse[];
    nextPoolPosition: number;
    shelfInstanceIds: string[];
}>;
export declare function buildMoviesFallbackShelf(): Promise<ShelfResponse>;
//# sourceMappingURL=movies-pool-service.d.ts.map