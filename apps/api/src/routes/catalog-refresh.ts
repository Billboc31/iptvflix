import type { FastifyInstance } from 'fastify'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { catalogRefreshRuns } from '../db/schema/catalog-refresh-runs.js'
import { CatalogRefreshService, CatalogRefreshAlreadyRunningError } from '../services/catalog-refresh-service.js'

interface CatalogRefreshRouteOptions {
  service: CatalogRefreshService
}

export async function catalogRefreshRoutes(
  app: FastifyInstance,
  opts: CatalogRefreshRouteOptions,
): Promise<void> {
  app.post('/catalog-refresh', async (_request, reply) => {
    let runId: string
    try {
      runId = await opts.service.run()
    } catch (err) {
      if (err instanceof CatalogRefreshAlreadyRunningError) {
        return reply.status(409).send({ error: err.message })
      }
      throw err
    }
    return reply.status(202).send({ runId, status: 'RUNNING' })
  })

  app.get('/catalog-refresh/status', async (_request, reply) => {
    const [run] = await db
      .select()
      .from(catalogRefreshRuns)
      .orderBy(desc(catalogRefreshRuns.startedAt))
      .limit(1)

    if (!run) return reply.status(404).send({ error: 'No catalog refresh run found' })
    return run
  })
}
