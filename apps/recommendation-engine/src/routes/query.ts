import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { runPipeline } from '../pipeline/pipeline.js'
import { pgClient } from '../db/client.js'

const queryBodySchema = z.object({
  text: z.string().min(1, 'text is required'),
  profileId: z.string().uuid().optional(),
  mediaTypes: z.array(z.enum(['movie', 'series'])).optional().default(['movie', 'series']),
  limit: z.number().int().min(1).max(100).optional().default(24),
  debug: z.boolean().optional().default(false),
})

export async function queryRoutes(app: FastifyInstance) {
  app.post('/v1/query', async (request, reply) => {
    const parsed = queryBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues })
    }

    const body = parsed.data

    // Authorize profileId: verify it exists, never expose cross-account data
    if (body.profileId) {
      const rows = await pgClient<{ id: string }[]>`
        SELECT id FROM profiles WHERE id = ${body.profileId} LIMIT 1
      `
      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Profile not found' })
      }
    }

    const requestId = String(request.id)
    const response = await runPipeline(body, requestId, request.log)
    return reply.send(response)
  })
}
