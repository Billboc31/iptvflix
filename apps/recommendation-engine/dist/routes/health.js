import { PIPELINE_VERSION } from '../pipeline/pipeline.js';
import { pgClient } from '../db/client.js';
export async function healthRoutes(app) {
    app.get('/health', async (_request, reply) => {
        try {
            await pgClient `SELECT 1`;
        }
        catch {
            return reply.status(503).send({
                status: 'error',
                reason: 'database unavailable',
                version: PIPELINE_VERSION,
                timestamp: new Date().toISOString(),
            });
        }
        return reply.send({
            status: 'ok',
            version: PIPELINE_VERSION,
            timestamp: new Date().toISOString(),
        });
    });
}
//# sourceMappingURL=health.js.map