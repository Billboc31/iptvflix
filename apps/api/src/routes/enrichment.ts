import type { FastifyInstance } from 'fastify'
import type { MetadataEnrichmentService } from '../services/metadata-enrichment-service.js'
import { TMDB_STALE_DAYS } from '../config/env.js'

interface EnrichmentRouteOptions {
  enrichmentService: MetadataEnrichmentService | null
}

export async function enrichmentRoutes(
  app: FastifyInstance,
  opts: EnrichmentRouteOptions,
): Promise<void> {
  app.post('/enrichment/trigger', async (_, reply) => {
    if (!opts.enrichmentService) {
      return reply.status(503).send({ error: 'Metadata provider not configured' })
    }
    const result = await opts.enrichmentService.enrichPending({ staleDays: TMDB_STALE_DAYS })
    return result
  })
}
