import type { ShelfResponse } from '@iptvflix/api-contracts';
export declare function getOrCreateSession(profileId: string): Promise<{
    id: string;
    profileId: string;
    cursorReference: string | null;
}>;
export declare function countUnserved(sessionId: string): Promise<number>;
export declare function serveBatch(sessionId: string, nextPosition: number, batchSize?: number): Promise<{
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
export declare function buildFixedShelves(profileId: string): Promise<ShelfResponse[]>;
export declare function fillPool(sessionId: string, profileId: string, targetCount: number): void;
export declare function fillPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void>;
export declare function buildFallbackShelf(): Promise<ShelfResponse>;
export declare function persistFixedShelvesForSession(profileId: string, sessionId: string, fixed: ShelfResponse[]): Promise<void>;
//# sourceMappingURL=home-pool-service.d.ts.map