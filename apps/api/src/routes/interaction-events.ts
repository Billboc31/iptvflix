import type { FastifyInstance } from 'fastify'
import type { InteractionEventBody } from '@iptvflix/api-contracts'
import { recordEvent, ALLOWED_EVENT_TYPES } from '../services/interaction-event-service.js'

export async function interactionEventsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: InteractionEventBody }>('/interaction-events', async (request, reply) => {
    const body = request.body ?? {}
    const { eventType } = body

    if (!eventType) {
      return reply.status(400).send({ error: 'eventType is required' })
    }
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return reply.status(400).send({
        error: `Unknown eventType: ${eventType}`,
        allowedTypes: [...ALLOWED_EVENT_TYPES],
      })
    }

    await recordEvent(request.profileId!, body)
    return reply.status(204).send()
  })
}
