import type { FastifyInstance } from 'fastify'
import type { InteractionEventBody, InteractionEventBatch } from '@iptvflix/api-contracts'
import { recordEvent, recordEventBatch, ALLOWED_EVENT_TYPES } from '../services/interaction-event-service.js'
import { openSession, closeSession } from '../services/viewing-session-service.js'

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

  // Batch endpoint — processes up to 50 events best-effort, never returns 5xx for analytics failures.
  // On PLAY_STARTED, opens a viewing session and returns sessionId.
  app.post<{ Body: InteractionEventBatch }>('/interaction-events/batch', async (request, reply) => {
    const body = request.body ?? {}
    const events: InteractionEventBody[] = Array.isArray(body.events) ? body.events.slice(0, 50) : []

    let sessionId: string | null = null

    for (const event of events) {
      try {
        if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) continue

        // Auto-open viewing session on PLAY_STARTED
        if (event.eventType === 'PLAY_STARTED' && event.mediaId && event.mediaType) {
          try {
            sessionId = await openSession({
              profileId: request.profileId!,
              mediaType: event.mediaType,
              mediaId: event.mediaId,
              episodeId: event.episodeId ?? null,
              startPositionMs: event.positionMs ?? 0,
              deviceType: event.deviceType ?? null,
              clientType: event.clientType ?? null,
              sourceId: event.sourceId ?? null,
              availabilityId: event.availabilityId ?? null,
            })
            event.sessionId = sessionId
          } catch (err) {
            console.warn('[interaction-events] openSession failed:', err)
          }
        }

        // Auto-close viewing session on PLAY_COMPLETED or PLAY_ABANDONED
        if ((event.eventType === 'PLAY_COMPLETED' || event.eventType === 'PLAY_ABANDONED') && event.sessionId) {
          try {
            await closeSession(event.sessionId, event.eventType === 'PLAY_COMPLETED')
          } catch (err) {
            console.warn('[interaction-events] closeSession failed:', err)
          }
        }

        await recordEvent(request.profileId!, event)
      } catch (err) {
        console.warn('[interaction-events] batch item error:', event.eventType, err)
      }
    }

    return reply.status(200).send({ sessionId })
  })
}
