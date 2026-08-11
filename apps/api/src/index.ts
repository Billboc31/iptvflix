import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { sourcesRoutes } from './routes/sources.js'
import { enrichmentRoutes } from './routes/enrichment.js'
import { PORT, CORS_ORIGIN, TMDB_API_KEY } from './config/env.js'
import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: CORS_ORIGIN })
await app.register(healthRoutes)
await app.register(sourcesRoutes)

const enrichmentService = TMDB_API_KEY
  ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null
await app.register(enrichmentRoutes, { enrichmentService })

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
