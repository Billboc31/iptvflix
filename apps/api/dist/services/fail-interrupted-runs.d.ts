import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface FailInterruptedRunsResult {
    syncRunIds: string[];
    bootstrapRunIds: string[];
    refreshRunIds: string[];
    reconciliationRunIds: string[];
}
/** Mark leftover RUNNING rows FAILED so a new process can start jobs after a deploy/crash. */
export declare function failInterruptedRuns(database: Db, reason?: string): Promise<FailInterruptedRunsResult>;
export {};
//# sourceMappingURL=fail-interrupted-runs.d.ts.map