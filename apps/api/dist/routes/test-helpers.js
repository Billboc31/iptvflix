import { db } from '../db/client.js';
import { movies, series, sources, syncRuns, movieAvailabilities, seriesAvailabilities } from '../db/schema/index.js';
export async function testHelpersRoutes(app) {
    // Hard reset all catalog and source data — only registered in non-production envs
    app.delete('/test/reset', async (_, reply) => {
        await db.delete(movieAvailabilities);
        await db.delete(seriesAvailabilities);
        await db.delete(syncRuns);
        await db.delete(movies);
        await db.delete(series);
        await db.delete(sources);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=test-helpers.js.map