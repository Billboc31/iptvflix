import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { segmentSelections } from '../db/schema/segment-selections.js';
export async function episodeSegmentsRoutes(app) {
    app.get('/episodes/:id/segments', async (request, reply) => {
        const { id } = request.params;
        const rows = await db
            .select({
            type: segmentSelections.type,
            startMs: segmentSelections.startMs,
            endMs: segmentSelections.endMs,
        })
            .from(segmentSelections)
            .where(eq(segmentSelections.episodeId, id))
            .orderBy(segmentSelections.startMs);
        const response = {
            episodeId: id,
            segments: rows.map((r) => ({ type: r.type, startMs: r.startMs, endMs: r.endMs })),
        };
        return reply.send(response);
    });
}
//# sourceMappingURL=episodes.js.map