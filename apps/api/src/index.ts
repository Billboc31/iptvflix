import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { sourcesRoutes } from './routes/sources.js'
import { enrichmentRoutes } from './routes/enrichment.js'
import { moviesRoutes } from './routes/movies.js'
import { seriesRoutes } from './routes/series.js'
import { searchRoutes } from './routes/search.js'
import { discoveryRoutes } from './routes/discovery.js'
import { genresRoutes } from './routes/genres.js'
import { syncRunsRoutes } from './routes/sync-runs.js'
import { watchlistRoutes } from './routes/watchlist.js'
import { viewingProgressRoutes } from './routes/viewing-progress.js'
import { shelvesRoutes } from './routes/shelves.js'
import { followReleaseRoutes } from './routes/follow-release.js'
import { feedbackRoutes } from './routes/feedback.js'
import { releaseLifecycleRoutes } from './routes/release-lifecycle.js'
import { catalogRoutes } from './routes/catalog.js'
import { profileRoutes } from './routes/profile.js'
import { testHelpersRoutes } from './routes/test-helpers.js'
import { PORT, CORS_ORIGIN, TMDB_API_KEY } from './config/env.js'
import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'
import { ExternalDiscoveryService } from './services/external-discovery-service.js'

const app = Fastify({ logger: true })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ error: status >= 500 ? 'Internal Server Error' : error.message })
})

await app.register(cors, { origin: CORS_ORIGIN })
await app.register(healthRoutes)
await app.register(sourcesRoutes)
await app.register(syncRunsRoutes)
await app.register(moviesRoutes)
await app.register(seriesRoutes)
const discoveryService = TMDB_API_KEY
  ? new ExternalDiscoveryService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null

await app.register(searchRoutes, { discoveryService: discoveryService ?? undefined })
await app.register(discoveryRoutes, { discoveryService })
await app.register(genresRoutes)
await app.register(watchlistRoutes)
await app.register(viewingProgressRoutes)
await app.register(shelvesRoutes)
await app.register(followReleaseRoutes)
await app.register(feedbackRoutes)
await app.register(releaseLifecycleRoutes)
await app.register(catalogRoutes)
await app.register(profileRoutes)

const enrichmentService = TMDB_API_KEY
  ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null
await app.register(enrichmentRoutes, { enrichmentService })

if (process.env.NODE_ENV !== 'production') {
  await app.register(testHelpersRoutes)
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
