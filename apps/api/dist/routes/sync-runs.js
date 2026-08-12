import { listSyncRuns, triggerSync } from '../services/sync-runs-service.js';
import { NotFoundError } from '../services/source-service.js';
export async function syncRunsRoutes(app) {
    app.get('/sync-runs', async () => {
        return listSyncRuns();
    });
    app.post('/sync-runs', async (request, reply) => {
        try {
            const run = await triggerSync(request.body ?? { sourceId: '' });
            return reply.status(201).send(run);
        }
        catch (err) {
            if (err instanceof NotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            const status = err.statusCode;
            if (status && status >= 400 && status < 500) {
                return reply.status(status).send({ error: err.message });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=sync-runs.js.map