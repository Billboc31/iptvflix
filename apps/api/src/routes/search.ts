import type { FastifyInstance } from 'fastify'
import type { ExternalMovieCandidate, ExternalSeriesCandidate } from '@iptvflix/api-contracts'
import {
  searchContent,
  getMovieTmdbIds,
  getSeriesTmdbIds,
} from '../services/catalog-service.js'
import type { ExternalDiscoveryService } from '../services/external-discovery-service.js'

interface SearchRouteOptions {
  discoveryService?: ExternalDiscoveryService
}

const LOCAL_RESULTS_THRESHOLD = 5

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

    const localResult = await searchContent(trimmed)
    const localTotal = localResult.movies.length + localResult.series.length

    let externalMovies: ExternalMovieCandidate[] = []
    let externalSeries: ExternalSeriesCandidate[] = []

    if (discoveryService && localTotal <= LOCAL_RESULTS_THRESHOLD) {
      const [excludeMovieTmdbIds, excludeSeriesTmdbIds] = await Promise.all([
        getMovieTmdbIds(localResult.movies.map((m) => m.id)),
        getSeriesTmdbIds(localResult.series.map((s) => s.id)),
      ])

      const [em, es] = await Promise.all([
        discoveryService.discoverMovies(trimmed, excludeMovieTmdbIds),
        discoveryService.discoverSeries(trimmed, excludeSeriesTmdbIds),
      ])
      externalMovies = em
      externalSeries = es
    }

    return { ...localResult, externalMovies, externalSeries }
  })
}
