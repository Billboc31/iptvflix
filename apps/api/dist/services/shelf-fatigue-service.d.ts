import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { FatigueState } from '@iptvflix/api-contracts';
type Db = PostgresJsDatabase<typeof schema>;
export declare class ShelfFatigueService {
    private readonly db;
    constructor(db: Db);
    getFatigueStates(profileId: string, conceptIds: string[]): Promise<Map<string, FatigueState>>;
    recordImpression(profileId: string, shelfConceptId: string, wasVisible: boolean): Promise<void>;
    recordInteraction(profileId: string, shelfConceptId: string): Promise<void>;
    suppressConcept(profileId: string, shelfConceptId: string, reason: string, version: string, cooldownUntil: Date): Promise<void>;
}
export {};
//# sourceMappingURL=shelf-fatigue-service.d.ts.map