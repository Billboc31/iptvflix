import { count, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mediaSegments } from '../db/schema/media-segments.js';
import { segmentSelections } from '../db/schema/segment-selections.js';
import { episodes } from '../db/schema/episodes.js';
export async function segmentAdminRoutes(app) {
    app.get('/admin/segments/coverage', async () => {
        const [totalEpisodesRow] = await db.select({ total: count() }).from(episodes);
        const totalEpisodes = Number(totalEpisodesRow?.total ?? 0);
        // Episodes with any raw segment
        const [anyRow] = await db.select({
            withAny: sql `cast(count(distinct episode_id) as integer)`,
        }).from(mediaSegments);
        const withAnyCount = Number(anyRow?.withAny ?? 0);
        // Episodes with a merged selection
        const [selectionRow] = await db.select({
            withSelection: sql `cast(count(distinct episode_id) as integer)`,
        }).from(segmentSelections);
        const episodesWithMergedSelection = Number(selectionRow?.withSelection ?? 0);
        // Per-provider episode counts
        const providerEpisodeCounts = await db
            .select({
            provider: mediaSegments.sourceProvider,
            episodeCount: sql `cast(count(distinct episode_id) as integer)`,
        })
            .from(mediaSegments)
            .groupBy(mediaSegments.sourceProvider);
        // Per-provider per-type episode counts
        const providerTypeCounts = await db
            .select({
            provider: mediaSegments.sourceProvider,
            type: mediaSegments.type,
            episodeCount: sql `cast(count(distinct episode_id) as integer)`,
        })
            .from(mediaSegments)
            .groupBy(mediaSegments.sourceProvider, mediaSegments.type);
        const byProvider = {};
        for (const row of providerEpisodeCounts) {
            byProvider[row.provider] = { episodes: Number(row.episodeCount), byType: {} };
        }
        for (const row of providerTypeCounts) {
            if (!byProvider[row.provider])
                byProvider[row.provider] = { episodes: 0, byType: {} };
            byProvider[row.provider].byType[row.type] = Number(row.episodeCount);
        }
        // Provider overlap: episodes with data from both introdb and theintrodb
        const overlapResult = await db.execute(sql `
      SELECT cast(count(distinct ms1.episode_id) as integer) as overlap
      FROM media_segments ms1
      INNER JOIN media_segments ms2
        ON ms1.episode_id = ms2.episode_id
      WHERE ms1.source_provider = 'introdb'
        AND ms2.source_provider = 'theintrodb'
    `);
        const overlapCount = Number(overlapResult[0]?.overlap ?? 0);
        // Disagreement rate: episodes where both providers have a segment of the same type
        // but their startMs values differ by more than 2000ms
        const disagreeResult = await db.execute(sql `
      SELECT cast(count(distinct ms1.episode_id) as integer) as disagree
      FROM media_segments ms1
      INNER JOIN media_segments ms2
        ON ms1.episode_id = ms2.episode_id
        AND ms1.type = ms2.type
      WHERE ms1.source_provider = 'introdb'
        AND ms2.source_provider = 'theintrodb'
        AND abs(ms1.start_ms - ms2.start_ms) > 2000
    `);
        const disagreeCount = Number(disagreeResult[0]?.disagree ?? 0);
        const disagreementRate = overlapCount > 0 ? Math.round((disagreeCount / overlapCount) * 1000) / 1000 : 0;
        const noDataRate = totalEpisodes > 0
            ? Math.round(((totalEpisodes - withAnyCount) / totalEpisodes) * 1000) / 1000
            : 0;
        return {
            totalEpisodes,
            episodesWithAnySegment: withAnyCount,
            episodesWithMergedSelection,
            byProvider,
            providerOverlap: { 'introdb+theintrodb': overlapCount },
            disagreementRate,
            noDataRate,
            identifierMismatchRate: null, // not implemented — requires per-lookup mismatch tracking
            animeEpisodes: null, // not implemented — requires isAnime field in episodes schema
            animeWithAnySegment: null, // not implemented — requires isAnime field in episodes schema
        };
    });
    app.get('/admin/segments/episode/:id', async (request, reply) => {
        const { id } = request.params;
        const rawSegments = await db
            .select({
            id: mediaSegments.id,
            episodeId: mediaSegments.episodeId,
            type: mediaSegments.type,
            startMs: mediaSegments.startMs,
            endMs: mediaSegments.endMs,
            sourceProvider: mediaSegments.sourceProvider,
            sourceExternalId: mediaSegments.sourceExternalId,
            confidence: mediaSegments.confidence,
            submissionCount: mediaSegments.submissionCount,
            status: mediaSegments.status,
            sourceUpdatedAt: mediaSegments.sourceUpdatedAt,
            createdAt: mediaSegments.createdAt,
            updatedAt: mediaSegments.updatedAt,
        })
            .from(mediaSegments)
            .where(eq(mediaSegments.episodeId, id))
            .orderBy(mediaSegments.startMs);
        const selections = await db
            .select({
            id: segmentSelections.id,
            episodeId: segmentSelections.episodeId,
            type: segmentSelections.type,
            startMs: segmentSelections.startMs,
            endMs: segmentSelections.endMs,
            selectedProvider: segmentSelections.selectedProvider,
            selectionReason: segmentSelections.selectionReason,
            provenance: segmentSelections.provenance,
            createdAt: segmentSelections.createdAt,
            updatedAt: segmentSelections.updatedAt,
        })
            .from(segmentSelections)
            .where(eq(segmentSelections.episodeId, id))
            .orderBy(segmentSelections.startMs);
        return { episodeId: id, rawSegments, selections };
    });
}
//# sourceMappingURL=segment-admin.js.map