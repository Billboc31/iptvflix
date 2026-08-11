import type { FastifyInstance } from 'fastify'
import { listGenres } from '../services/catalog-service.js'

export async function genresRoutes(app: FastifyInstance): Promise<void> {
  app.get('/genres', async () => {
    return listGenres()
  })
}
