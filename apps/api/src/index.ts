import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'

const app = Fastify({ logger: true })

const port = Number(process.env.PORT ?? 3000)
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

await app.register(cors, { origin: corsOrigin })
await app.register(healthRoutes)

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
