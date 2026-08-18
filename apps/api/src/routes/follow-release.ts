import type { FastifyInstance } from 'fastify'
import type { FollowReleaseRequest } from '@iptvflix/api-contracts'
import { follow, unfollow, listFollowed } from '../services/follow-release-service.js'

export async function followReleaseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/follow-release', async (request) => {
    return listFollowed(request.profileId!)
  })

  app.post<{ Body: FollowReleaseRequest }>('/follow-release', async (request, reply) => {
    const { mediaType, mediaId } = request.body ?? {}
    if (!mediaType || !mediaId) {
      return reply.status(400).send({ error: 'mediaType and mediaId are required' })
    }
    if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
      return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
    }
    const entry = await follow(request.profileId!, mediaType, mediaId)
    return reply.status(201).send(entry)
  })

  app.delete<{ Params: { mediaType: string; mediaId: string } }>(
    '/follow-release/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      await unfollow(request.profileId!, mediaType as 'MOVIE' | 'SERIES', mediaId)
      return reply.status(204).send()
    },
  )
}
