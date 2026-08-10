import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { PORT, CORS_ORIGIN } from './config/env.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: CORS_ORIGIN })
await app.register(healthRoutes)

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
