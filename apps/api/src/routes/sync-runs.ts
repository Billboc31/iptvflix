import type { FastifyInstance } from 'fastify'
import type { TriggerSyncBody } from '@iptvflix/api-contracts'
import { listSyncRuns, triggerSync } from '../services/sync-runs-service.js'
import { NotFoundError } from '../services/source-service.js'

export async function syncRunsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sync-runs', async () => {
    return listSyncRuns()
  })

  app.post<{ Body: TriggerSyncBody }>('/sync-runs', async (request, reply) => {
    try {
      const run = await triggerSync(request.body ?? { sourceId: '' })
      return reply.status(201).send(run)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      const status = (err as Error & { statusCode?: number }).statusCode
      if (status && status >= 400 && status < 500) {
        return reply.status(status).send({ error: (err as Error).message })
      }
      throw err
    }
  })
}
