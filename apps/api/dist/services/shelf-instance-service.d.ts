import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { ShelfInstanceDetail, PersistShelfInstanceParams } from '@iptvflix/api-contracts';
type Db = PostgresJsDatabase<typeof schema>;
export declare class ShelfInstanceService {
    private readonly db;
    constructor(db: Db);
    persistShelfInstance(params: PersistShelfInstanceParams): Promise<string>;
    markFirstDisplayed(shelfInstanceId: string, at?: Date): Promise<void>;
    markItemVisible(shelfInstanceId: string, mediaId: string, mediaType: string): Promise<void>;
    markItemOpened(shelfInstanceId: string, mediaId: string, mediaType: string, at: Date): Promise<void>;
    markItemPlayed(shelfInstanceId: string, mediaId: string, mediaType: string, at: Date): Promise<void>;
    getShelfInstanceWithItems(id: string): Promise<ShelfInstanceDetail | null>;
    listProfileShelfInstances(profileId: string, limit: number, before?: string): Promise<ShelfInstanceDetail[]>;
}
export {};
//# sourceMappingURL=shelf-instance-service.d.ts.map