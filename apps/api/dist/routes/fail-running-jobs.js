import { db } from '../db/client.js';
import { failInterruptedRuns } from '../services/fail-interrupted-runs.js';
export async function failRunningJobsRoutes(app) {
    app.post('/admin/fail-running-jobs', async () => {
        return failInterruptedRuns(db);
    });
}
//# sourceMappingURL=fail-running-jobs.js.map