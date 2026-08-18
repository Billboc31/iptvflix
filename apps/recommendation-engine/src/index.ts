import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PORT, LOG_LEVEL, CORS_ORIGIN, OPENAI_API_KEY } from './config.js'
import { healthRoutes } from './routes/health.js'
import { queryRoutes } from './routes/query.js'

const app = Fastify({
  logger: { level: LOG_LEVEL },
  genReqId: () => crypto.randomUUID(),
})

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ error: status >= 500 ? 'Internal Server Error' : error.message })
})

await app.register(cors, { origin: CORS_ORIGIN })

await app.register(healthRoutes)
await app.register(queryRoutes)

if (!OPENAI_API_KEY) {
  app.log.warn('OPENAI_API_KEY is not set — llm-planner stage will report unavailable')
}

process.on('SIGTERM', async () => {
  app.log.info('SIGTERM received, shutting down')
  await app.close()
  process.exit(0)
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
