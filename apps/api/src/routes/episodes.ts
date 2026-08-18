import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mediaSegments } from '../db/schema/media-segments.js'
import type { EpisodeSegmentsResponse } from '@iptvflix/api-contracts'

export async function episodeSegmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/episodes/:id/segments', async (request, reply) => {
    const { id } = request.params

    const rows = await db
      .select({
        type: mediaSegments.type,
        startMs: mediaSegments.startMs,
        endMs: mediaSegments.endMs,
      })
      .from(mediaSegments)
      .where(eq(mediaSegments.episodeId, id))
      .orderBy(mediaSegments.startMs)

    const response: EpisodeSegmentsResponse = {
      episodeId: id,
      segments: rows.map((r) => ({ type: r.type, startMs: r.startMs, endMs: r.endMs })),
    }

    return reply.send(response)
  })
}
