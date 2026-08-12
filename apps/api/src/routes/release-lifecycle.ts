import type { FastifyInstance } from 'fastify'
import { getTimeline } from '../services/release-lifecycle-service.js'

export async function releaseLifecycleRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { mediaType: string; mediaId: string } }>(
    '/release-lifecycle/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      const lifecycle = await getTimeline(mediaType as 'MOVIE' | 'SERIES', mediaId)
      return reply.send(lifecycle)
    },
  )
}
