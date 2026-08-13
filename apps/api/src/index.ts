import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
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
import { tasteRoutes } from './routes/taste.js'
import { recommendationRoutes } from './routes/recommendations.js'
import { homeRoutes } from './routes/home.js'
import { releaseLifecycleRoutes } from './routes/release-lifecycle.js'
import { catalogRoutes } from './routes/catalog.js'
import { profileRoutes } from './routes/profile.js'
import { pairingRoutes } from './routes/pairing.js'
import { devicesRoutes } from './routes/devices.js'
import { commandsRoutes } from './routes/commands.js'
import { playbackRoutes } from './routes/playback.js'
import { testHelpersRoutes } from './routes/test-helpers.js'
import { authRoutes } from './routes/auth.js'
import { schedulerRoutes } from './routes/scheduler.js'
import { arrivalsRoutes } from './routes/arrivals.js'
import { authenticate } from './plugins/auth.js'
import {
  PORT,
  CORS_ORIGIN,
  TMDB_API_KEY,
  JWT_SECRET,
  SYNC_SCHEDULER_ENABLED,
  SOURCE_SYNC_CADENCE_MINUTES,
  DISCOVERY_CADENCE_MINUTES,
  SOURCE_SYNC_CONCURRENCY,
  SCHEDULER_STARTUP_DELAY_MS,
} from './config/env.js'
import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'
import { ExternalDiscoveryService } from './services/external-discovery-service.js'
import { DiscoveryCandidatePoolService } from './services/discovery-candidate-pool-service.js'
import { SchedulerService } from './services/scheduler-service.js'
import { triggerSync } from './services/sync-runs-service.js'

const app = Fastify({ logger: true })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ error: status >= 500 ? 'Internal Server Error' : error.message })
})

await app.register(cors, { origin: CORS_ORIGIN, credentials: true })
await app.register(jwt, { secret: JWT_SECRET })
await app.register(cookie)

// Public routes
await app.register(healthRoutes)
await app.register(authRoutes)
await app.register(moviesRoutes)
await app.register(seriesRoutes)
await app.register(genresRoutes)
await app.register(catalogRoutes)
await app.register(releaseLifecycleRoutes)

const discoveryService = TMDB_API_KEY
  ? new ExternalDiscoveryService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null

await app.register(searchRoutes, { discoveryService: discoveryService ?? undefined })
await app.register(pairingRoutes)
await app.register(devicesRoutes)
await app.register(commandsRoutes)

// Protected routes
await app.register(async function protectedScope(protectedApp) {
  protectedApp.addHook('preHandler', authenticate)

  await protectedApp.register(sourcesRoutes)
  await protectedApp.register(syncRunsRoutes)
  await protectedApp.register(profileRoutes)
  await protectedApp.register(watchlistRoutes)
  await protectedApp.register(viewingProgressRoutes)
  await protectedApp.register(playbackRoutes)
  await protectedApp.register(shelvesRoutes)
  await protectedApp.register(followReleaseRoutes)
  await protectedApp.register(feedbackRoutes)
  await protectedApp.register(tasteRoutes)
  await protectedApp.register(recommendationRoutes)
  await protectedApp.register(homeRoutes)
  await protectedApp.register(arrivalsRoutes)
  await protectedApp.register(discoveryRoutes, { discoveryService })

  const enrichmentService = TMDB_API_KEY
    ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
    : null
  await protectedApp.register(enrichmentRoutes, { enrichmentService })
})

if (process.env.NODE_ENV !== 'production') {
  await app.register(testHelpersRoutes)
}

await app.register(schedulerRoutes, {
  enabled: SYNC_SCHEDULER_ENABLED,
  sourceSyncCadenceMinutes: SOURCE_SYNC_CADENCE_MINUTES,
  discoveryCadenceMinutes: DISCOVERY_CADENCE_MINUTES,
})

const discoveryPoolService =
  TMDB_API_KEY && discoveryService
    ? new DiscoveryCandidatePoolService(
        db,
        new TmdbClient({ apiKey: TMDB_API_KEY }),
        discoveryService,
      )
    : null

const scheduler = new SchedulerService(db, triggerSync, discoveryPoolService, {
  enabled: SYNC_SCHEDULER_ENABLED,
  sourceSyncCadenceMinutes: SOURCE_SYNC_CADENCE_MINUTES,
  discoveryCadenceMinutes: DISCOVERY_CADENCE_MINUTES,
  sourceSyncConcurrency: SOURCE_SYNC_CONCURRENCY,
  startupDelayMs: SCHEDULER_STARTUP_DELAY_MS,
})
scheduler.start()

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
