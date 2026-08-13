import type { FastifyInstance } from 'fastify'
import {
  searchContent,
  getMovieTmdbIds,
  getSeriesTmdbIds,
} from '../services/catalog-service.js'
import type { ExternalDiscoveryService } from '../services/external-discovery-service.js'

interface SearchRouteOptions {
  discoveryService?: ExternalDiscoveryService
}

export async function searchRoutes(
  app: FastifyInstance,
  opts: SearchRouteOptions,
): Promise<void> {
  const { discoveryService } = opts

  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string }

    if (!q || !q.trim()) {
      return reply.status(400).send({ error: 'q is required' })
    }

    const trimmed = q.trim()
    if (trimmed.length > 200) {
      return reply.status(400).send({ error: 'q must be 200 characters or fewer' })
    }

    return searchContent(trimmed)
  })

  app.get('/search/remote', async (request, reply) => {
    const { q } = request.query as { q?: string }

    if (!q || !q.trim()) {
      return reply.status(400).send({ error: 'q is required' })
    }

    const trimmed = q.trim()
    if (trimmed.length > 200) {
      return reply.status(400).send({ error: 'q must be 200 characters or fewer' })
    }

    if (!discoveryService) {
      return { externalMovies: [], externalSeries: [] }
    }

    try {
      const localResult = await searchContent(trimmed)
      const [excludeMovieTmdbIds, excludeSeriesTmdbIds] = await Promise.all([
        getMovieTmdbIds(localResult.movies.map((m) => m.id)),
        getSeriesTmdbIds(localResult.series.map((s) => s.id)),
      ])

      const [externalMovies, externalSeries] = await Promise.all([
        discoveryService.discoverMovies(trimmed, excludeMovieTmdbIds),
        discoveryService.discoverSeries(trimmed, excludeSeriesTmdbIds),
      ])

      return { externalMovies, externalSeries }
    } catch {
      return { externalMovies: [], externalSeries: [] }
    }
  })
}
