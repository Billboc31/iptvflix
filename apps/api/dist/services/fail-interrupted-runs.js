import { eq } from 'drizzle-orm';
import { catalogBootstrapRuns } from '../db/schema/catalog-bootstrap-runs.js';
import { catalogRefreshRuns } from '../db/schema/catalog-refresh-runs.js';
import { reconciliationRuns } from '../db/schema/reconciliation-runs.js';
import { syncRuns } from '../db/schema/sync-runs.js';
const DEFAULT_REASON = 'interrupted by deploy';
/** Mark leftover RUNNING rows FAILED so a new process can start jobs after a deploy/crash. */
export async function failInterruptedRuns(database, reason = DEFAULT_REASON) {
    const patch = {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: reason,
    };
    const [syncRows, bootstrapRows, refreshRows, reconciliationRows] = await Promise.all([
        database.update(syncRuns).set(patch).where(eq(syncRuns.status, 'RUNNING')).returning({ id: syncRuns.id }),
        database
            .update(catalogBootstrapRuns)
            .set(patch)
            .where(eq(catalogBootstrapRuns.status, 'RUNNING'))
            .returning({ id: catalogBootstrapRuns.id }),
        database
            .update(catalogRefreshRuns)
            .set(patch)
            .where(eq(catalogRefreshRuns.status, 'RUNNING'))
            .returning({ id: catalogRefreshRuns.id }),
        database
            .update(reconciliationRuns)
            .set(patch)
            .where(eq(reconciliationRuns.status, 'RUNNING'))
            .returning({ id: reconciliationRuns.id }),
    ]);
    return {
        syncRunIds: syncRows.map((row) => row.id),
        bootstrapRunIds: bootstrapRows.map((row) => row.id),
        refreshRunIds: refreshRows.map((row) => row.id),
        reconciliationRunIds: reconciliationRows.map((row) => row.id),
    };
}
//# sourceMappingURL=fail-interrupted-runs.js.map