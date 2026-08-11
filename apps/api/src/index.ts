import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { sourcesRoutes } from './routes/sources.js'
import { enrichmentRoutes } from './routes/enrichment.js'
import { moviesRoutes } from './routes/movies.js'
import { seriesRoutes } from './routes/series.js'
import { searchRoutes } from './routes/search.js'
import { genresRoutes } from './routes/genres.js'
import { PORT, CORS_ORIGIN, TMDB_API_KEY } from './config/env.js'
import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'

const app = Fastify({ logger: true })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ error: status >= 500 ? 'Internal Server Error' : error.message })
})

await app.register(cors, { origin: CORS_ORIGIN })
await app.register(healthRoutes)
await app.register(sourcesRoutes)
await app.register(moviesRoutes)
await app.register(seriesRoutes)
await app.register(searchRoutes)
await app.register(genresRoutes)

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
