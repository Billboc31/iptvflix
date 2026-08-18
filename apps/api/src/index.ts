import 'dotenv/config'
import { spawn } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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
import { profilesRoutes } from './routes/profiles.js'
import { interactionEventsRoutes } from './routes/interaction-events.js'
import { pairingRoutes } from './routes/pairing.js'
import { devicesRoutes } from './routes/devices.js'
import { commandsRoutes } from './routes/commands.js'
import { playbackRoutes } from './routes/playback.js'
import { mediaRelayHeartbeatRoutes } from './routes/media-relay-heartbeat.js'
import { testHelpersRoutes } from './routes/test-helpers.js'
import { authRoutes } from './routes/auth.js'
import { schedulerRoutes } from './routes/scheduler.js'
import { arrivalsRoutes } from './routes/arrivals.js'
import { reconcileRoutes, episodeBackfillRoutes } from './routes/reconcile.js'
import { catalogBootstrapRoutes } from './routes/catalog-bootstrap.js'
import { catalogRefreshRoutes } from './routes/catalog-refresh.js'
import { catalogStatsRoutes } from './routes/catalog-stats.js'
import { embeddingBackfillRoutes } from './routes/embedding-backfill.js'
import { failRunningJobsRoutes } from './routes/fail-running-jobs.js'
import { authenticate, requireProfile } from './plugins/auth.js'
import { failInterruptedRuns } from './services/fail-interrupted-runs.js'
import { runSeed } from './db/seed.js'
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
  CATALOG_REFRESH_ENABLED,
  CATALOG_REFRESH_CADENCE_HOURS,
} from './config/env.js'

import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'
import { ExternalDiscoveryService } from './services/external-discovery-service.js'
import { SimilarTitlesService } from './services/similar-titles-service.js'
import { DiscoveryCandidatePoolService } from './services/discovery-candidate-pool-service.js'
import { SchedulerService } from './services/scheduler-service.js'
import { TitleMatchingService } from './services/title-matching-service.js'
import { MediaReconciliationService } from './services/media-reconciliation-service.js'
import { EpisodeBackfillService } from './services/episode-backfill-service.js'
import { CatalogBootstrapService } from './services/catalog-bootstrap-service.js'
import { CatalogRefreshService } from './services/catalog-refresh-service.js'
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

// Run idempotent boot-time seed (account + default profile) before accepting requests
try {
  await runSeed()
  app.log.info('startup: account/profile seed completed')
} catch (err) {
  app.log.error(err, 'startup: seed failed — login may not work until DB is healthy')
}

const similarTitlesService = TMDB_API_KEY
  ? new SimilarTitlesService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : undefined

// Public routes
await app.register(healthRoutes)
await app.register(mediaRelayHeartbeatRoutes)
await app.register(authRoutes)
await app.register(moviesRoutes, { similarTitlesService })
await app.register(seriesRoutes, { similarTitlesService })
await app.register(genresRoutes)
await app.register(catalogRoutes, {
  enrichmentService: TMDB_API_KEY
    ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
    : undefined,
})
await app.register(releaseLifecycleRoutes)

const discoveryService = TMDB_API_KEY
  ? new ExternalDiscoveryService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null

await app.register(searchRoutes, { discoveryService: discoveryService ?? undefined })
await app.register(pairingRoutes)
await app.register(devicesRoutes)
await app.register(commandsRoutes)

let catalogRefreshServiceRef: CatalogRefreshService | null = null

// Protected routes — require valid JWT (authenticate)
await app.register(async function protectedScope(protectedApp) {
  protectedApp.addHook('preHandler', authenticate)

  // Account-level routes (no profileId needed)
  await protectedApp.register(sourcesRoutes)
  await protectedApp.register(syncRunsRoutes)
  await protectedApp.register(failRunningJobsRoutes)
  await protectedApp.register(profilesRoutes)
  await protectedApp.register(discoveryRoutes, { discoveryService })
  await protectedApp.register(recommendationRoutes)
  await protectedApp.register(homeRoutes)

  const enrichmentService = TMDB_API_KEY
    ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
    : null
  await protectedApp.register(enrichmentRoutes, { enrichmentService })

  const reconciliationService = TMDB_API_KEY
    ? new MediaReconciliationService(new TitleMatchingService(new TmdbClient({ apiKey: TMDB_API_KEY })))
    : null
  if (reconciliationService) {
    await protectedApp.register(reconcileRoutes, { reconciliationService })
  }

  const backfillService = new EpisodeBackfillService()
  await protectedApp.register(episodeBackfillRoutes, { backfillService })

  if (TMDB_API_KEY) {
    const bootstrapEnrichmentService = new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
    const bootstrapService = new CatalogBootstrapService(
      db,
      new TmdbClient({ apiKey: TMDB_API_KEY }),
      undefined,
      bootstrapEnrichmentService,
    )
    await protectedApp.register(catalogBootstrapRoutes, { service: bootstrapService })

    const refreshEnrichmentService = new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
    const refreshService = new CatalogRefreshService(
      db,
      new TmdbClient({ apiKey: TMDB_API_KEY }),
      refreshEnrichmentService,
    )
    await protectedApp.register(catalogRefreshRoutes, { service: refreshService })
    catalogRefreshServiceRef = refreshService
  }

  await protectedApp.register(catalogStatsRoutes)
  await protectedApp.register(embeddingBackfillRoutes)

  // Profile-scoped routes — also require a profileId in the session JWT
  await protectedApp.register(async function profileScope(profileApp) {
    profileApp.addHook('preHandler', requireProfile)

    await profileApp.register(profileRoutes)
    await profileApp.register(watchlistRoutes)
    await profileApp.register(viewingProgressRoutes)
    await profileApp.register(playbackRoutes)
    await profileApp.register(shelvesRoutes)
    await profileApp.register(feedbackRoutes)
    await profileApp.register(tasteRoutes)
    await profileApp.register(interactionEventsRoutes)
    await profileApp.register(followReleaseRoutes)
    await profileApp.register(arrivalsRoutes)
  })
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

const scheduler = new SchedulerService(
  db,
  triggerSync,
  discoveryPoolService,
  {
    enabled: SYNC_SCHEDULER_ENABLED,
    sourceSyncCadenceMinutes: SOURCE_SYNC_CADENCE_MINUTES,
    discoveryCadenceMinutes: DISCOVERY_CADENCE_MINUTES,
    sourceSyncConcurrency: SOURCE_SYNC_CONCURRENCY,
    startupDelayMs: SCHEDULER_STARTUP_DELAY_MS,
    catalogRefreshEnabled: CATALOG_REFRESH_ENABLED,
    catalogRefreshCadenceHours: CATALOG_REFRESH_CADENCE_HOURS,
  },
  catalogRefreshServiceRef,
)
try {
  const cleared = await failInterruptedRuns(db)
  app.log.info(cleared, 'cleared interrupted RUNNING jobs')
} catch (err) {
  app.log.error(err, 'failed to clear interrupted RUNNING jobs')
}

scheduler.start()

// Best-effort ffmpeg/ffprobe check — never block API boot (auth/catalog must stay up).
// Missing binaries only degrade HLS playback; DIRECT mode and login still work.
async function checkBinary(binary: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${binary} exited with code ${code}`))
    })
    proc.on('error', (err) => reject(new Error(`${binary} not found: ${err.message}`)))
  })
}

try {
  await Promise.all([checkBinary('ffmpeg'), checkBinary('ffprobe')])
  app.log.info('startup: ffmpeg and ffprobe available')
} catch (err) {
  app.log.warn({ err }, 'startup: ffmpeg/ffprobe unavailable — HLS playback will fail until binaries are provisioned')
}

// Best-effort temp-dir check for HLS segment writes.
try {
  const testPath = join(tmpdir(), `.iptvflix-startup-check-${Date.now()}`)
  await writeFile(testPath, '')
  await unlink(testPath)
  app.log.info({ tmpdir: tmpdir() }, 'startup: temp directory is writable')
} catch (err) {
  app.log.warn({ err }, 'startup: temp directory not writable — HLS segment writes may fail')
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
