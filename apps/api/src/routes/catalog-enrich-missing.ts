import type { FastifyInstance } from 'fastify'
import type { CatalogEnrichMissingService } from '../services/catalog-enrich-missing-service.js'

export async function catalogEnrichMissingRoutes(
  app: FastifyInstance,
  opts: { service: CatalogEnrichMissingService },
): Promise<void> {
  const { service } = opts

  app.post('/admin/catalog-enrich-missing', async (request, reply) => {
    const body = request.body as {
      mediaTypes?: ('MOVIE' | 'SERIES')[]
      batchSize?: number
      concurrency?: number
      throttleMs?: number
      force?: boolean
    } | undefined

    const runId = await service.start({
      mediaTypes: body?.mediaTypes,
      batchSize: body?.batchSize,
      concurrency: body?.concurrency,
      throttleMs: body?.throttleMs,
      force: body?.force,
    })

    return reply.status(202).send({ runId })
  })

  app.get('/admin/catalog-enrich-missing/status', async (_request, reply) => {
    const status = await service.getLatestRunStatus()
    if (!status) return reply.status(404).send({ error: 'No enrich-missing run found' })
    return status
  })

  app.get('/admin/catalog-enrich-missing/failures', async (request, reply) => {
    const query = request.query as {
      page?: string
      limit?: string
      mediaType?: string
      retryable?: string
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(query.limit ?? '50', 10) || 50))
    const mediaType = query.mediaType
    const retryable =
      query.retryable === 'true' ? true : query.retryable === 'false' ? false : undefined

    const result = await service.listFailures({ page, limit, mediaType, retryable })
    return { page, limit, total: result.total, rows: result.rows }
  })

  app.post('/admin/catalog-enrich-missing/retry-failures', async (request, reply) => {
    const body = request.body as {
      mediaType?: string
      ids?: string[]
    } | undefined

    const result = await service.retryFailures({
      mediaType: body?.mediaType,
      ids: body?.ids,
    })

    return reply.status(202).send(result)
  })
}
