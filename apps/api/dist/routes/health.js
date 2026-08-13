import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
export async function healthRoutes(app) {
    app.get('/health', async (_req, reply) => {
        let dbStatus;
        try {
            await db.execute(sql `SELECT 1`);
            dbStatus = 'ok';
        }
        catch {
            dbStatus = 'unavailable';
        }
        if (dbStatus === 'unavailable') {
            return reply.status(503).send({ status: 'ok', db: dbStatus });
        }
        return reply.send({ status: 'ok', db: dbStatus });
    });
}
//# sourceMappingURL=health.js.map