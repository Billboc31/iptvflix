import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
export async function healthRoutes(app) {
    app.get('/health', async () => {
        let dbStatus;
        try {
            await db.execute(sql `SELECT 1`);
            dbStatus = 'ok';
        }
        catch {
            dbStatus = 'unavailable';
        }
        return { status: 'ok', db: dbStatus };
    });
}
//# sourceMappingURL=health.js.map