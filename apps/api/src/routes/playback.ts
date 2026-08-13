import type { FastifyInstance } from 'fastify'
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts'
import { resolvePlayback } from '../services/playback-resolver.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { mediaType: string; mediaId: string }
    Body: PlaybackResolveRequest
  }>(
    '/playback/resolve/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params

      if (mediaType !== 'movie' && mediaType !== 'episode') {
        return reply.status(400).send({ error: 'mediaType must be movie or episode' })
      }
      if (!UUID_RE.test(mediaId)) {
        return reply.status(400).send({ error: 'Invalid mediaId' })
      }

      const { availabilityId } = request.body ?? {}

      try {
        const session = await resolvePlayback(
          DEFAULT_PROFILE_ID,
          mediaType,
          mediaId,
          availabilityId,
        )
        return reply.status(200).send(session)
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.status(404).send({ error: 'Variant not available' })
        }
        if (err instanceof ValidationError) {
          return reply.status(400).send({ error: 'Variant not available' })
        }
        if (err instanceof ForbiddenError) {
          return reply.status(403).send({ error: 'Variant not available' })
        }
        throw err
      }
    },
  )
}
