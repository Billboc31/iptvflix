import type { FastifyInstance } from 'fastify'
import type { SetFeedbackBody, WatchlistMediaType } from '@iptvflix/api-contracts'
import { upsertFeedback, removeFeedback, listFeedback } from '../services/feedback-service.js'
import { NotFoundError } from '../errors.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.get('/feedback', async () => {
    return listFeedback(DEFAULT_PROFILE_ID)
  })

  app.put<{ Params: { mediaType: string; mediaId: string }; Body: SetFeedbackBody }>(
    '/feedback/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      const { feedback } = request.body ?? {}
      if (!feedback) {
        return reply.status(400).send({ error: 'feedback is required' })
      }
      if (feedback !== 'LIKE' && feedback !== 'DISLIKE' && feedback !== 'NOT_INTERESTED') {
        return reply.status(400).send({ error: 'feedback must be LIKE, DISLIKE, or NOT_INTERESTED' })
      }
      try {
        const item = await upsertFeedback(DEFAULT_PROFILE_ID, mediaType as WatchlistMediaType, mediaId, feedback)
        return reply.status(200).send(item)
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.status(404).send({ error: err.message })
        }
        throw err
      }
    },
  )

  app.delete<{ Params: { mediaType: string; mediaId: string } }>(
    '/feedback/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      await removeFeedback(DEFAULT_PROFILE_ID, mediaType as WatchlistMediaType, mediaId)
      return reply.status(204).send()
    },
  )
}
