import type { FastifyInstance } from 'fastify'
import { getTaste, buildTaste } from '../services/profile-taste-service.js'

export async function tasteRoutes(app: FastifyInstance): Promise<void> {
  app.get('/taste', async (request) => {
    return getTaste(request.profileId!)
  })

  app.post('/taste/rebuild', async (request) => {
    return buildTaste(request.profileId!)
  })
}
