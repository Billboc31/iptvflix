import type { FastifyInstance } from 'fastify'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { catalogBootstrapRuns } from '../db/schema/catalog-bootstrap-runs.js'
import { CatalogBootstrapService, BootstrapAlreadyRunningError } from '../services/catalog-bootstrap-service.js'

interface CatalogBootstrapRouteOptions {
  service: CatalogBootstrapService
}

export async function catalogBootstrapRoutes(
  app: FastifyInstance,
  opts: CatalogBootstrapRouteOptions,
): Promise<void> {
  app.post('/catalog-bootstrap', async (_request, reply) => {
    let runId: string
    try {
      runId = await opts.service.start()
    } catch (err) {
      if (err instanceof BootstrapAlreadyRunningError) {
        return reply.status(409).send({ error: err.message })
      }
      throw err
    }
    return reply.status(201).send({ runId, status: 'RUNNING' })
  })

  app.get('/catalog-bootstrap/status', async (_request, reply) => {
    const [run] = await db
      .select()
      .from(catalogBootstrapRuns)
      .orderBy(desc(catalogBootstrapRuns.startedAt))
      .limit(1)

    if (!run) return reply.status(404).send({ error: 'No bootstrap run found' })
    return run
  })
}
