import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { episodes } from '../db/schema/episodes.js';
import { seasons } from '../db/schema/seasons.js';
import { series as seriesTable } from '../db/schema/series.js';
import { segmentSelections } from '../db/schema/segment-selections.js';
import { resolveMediaImageUrl } from '../lib/tmdb-image.js';
function displayEpisodeTitle(title) {
    if (title == null)
        return null;
    const trimmed = title.trim();
    if (!trimmed)
        return null;
    if (/^S\d{1,2}E\d{1,3}$/i.test(trimmed))
        return null;
    return trimmed;
}
export async function episodeSegmentsRoutes(app) {
    app.get('/episodes/:id', async (request, reply) => {
        const { id } = request.params;
        const [row] = await db
            .select({
            id: episodes.id,
            seriesId: episodes.seriesId,
            seasonNumber: seasons.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            title: episodes.title,
            posterPath: episodes.posterPath,
            seasonPosterPath: seasons.posterPath,
            seriesPosterPath: seriesTable.posterPath,
        })
            .from(episodes)
            .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
            .innerJoin(seriesTable, eq(seriesTable.id, episodes.seriesId))
            .where(eq(episodes.id, id))
            .limit(1);
        if (!row) {
            return reply.status(404).send({ error: 'Episode not found' });
        }
        const response = {
            id: row.id,
            seriesId: row.seriesId,
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
            title: displayEpisodeTitle(row.title),
            posterUrl: resolveMediaImageUrl(row.posterPath ?? row.seasonPosterPath ?? row.seriesPosterPath),
        };
        return reply.send(response);
    });
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