import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { ConceptPerformance, ProfileMediaExposureEntry } from '@iptvflix/api-contracts';
type Db = PostgresJsDatabase<typeof schema>;
export declare class ShelfPerformanceService {
    private readonly db;
    constructor(db: Db);
    getConceptPerformance(profileId: string, shelfConceptId: string): Promise<ConceptPerformance>;
    getProfileMediaExposureBatch(profileId: string, mediaIds: string[]): Promise<Map<string, ProfileMediaExposureEntry>>;
    getRecentlyExposedMediaIds(profileId: string, hoursBack: number): Promise<string[]>;
}
export {};
//# sourceMappingURL=shelf-performance-service.d.ts.map