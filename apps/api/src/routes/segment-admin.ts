import type { FastifyInstance } from 'fastify'
import { count, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mediaSegments } from '../db/schema/media-segments.js'
import { episodes } from '../db/schema/episodes.js'

export async function segmentAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/segments/coverage', async () => {
    const [totalEpisodesRow] = await db.select({ total: count() }).from(episodes)
    const totalEpisodes = Number(totalEpisodesRow?.total ?? 0)

    const [coverageRows] = await db.select({
      withIntro: sql<number>`cast(count(distinct episode_id) filter (where type = 'INTRO') as integer)`,
      withRecap: sql<number>`cast(count(distinct episode_id) filter (where type = 'RECAP') as integer)`,
      withOutro: sql<number>`cast(count(distinct episode_id) filter (where type = 'OUTRO') as integer)`,
      withCredits: sql<number>`cast(count(distinct episode_id) filter (where type = 'CREDITS') as integer)`,
      totalSegmentRows: count(),
    }).from(mediaSegments)

    const withAnySegment = await db
      .selectDistinct({ episodeId: mediaSegments.episodeId })
      .from(mediaSegments)
    const withAnyCount = withAnySegment.length
    const noData = totalEpisodes - withAnyCount

    const providerRows = await db
      .select({
        provider: mediaSegments.sourceProvider,
        segmentCount: count(),
      })
      .from(mediaSegments)
      .groupBy(mediaSegments.sourceProvider)

    return {
      totalEpisodes,
      withAnySegment: withAnyCount,
      noData,
      byType: {
        intro: Number(coverageRows?.withIntro ?? 0),
        recap: Number(coverageRows?.withRecap ?? 0),
        outro: Number(coverageRows?.withOutro ?? 0),
        credits: Number(coverageRows?.withCredits ?? 0),
      },
      totalSegmentRows: Number(coverageRows?.totalSegmentRows ?? 0),
      byProvider: providerRows.map((r) => ({ provider: r.provider, count: Number(r.segmentCount) })),
    }
  })

  app.get<{ Params: { id: string } }>('/admin/segments/episode/:id', async (request, reply) => {
    const { id } = request.params

    const rows = await db
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
      .orderBy(mediaSegments.startMs)

    return { episodeId: id, segments: rows }
  })
}
