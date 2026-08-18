import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { ShelfInstanceService } from '../services/shelf-instance-service.js'
import { ShelfPerformanceService } from '../services/shelf-performance-service.js'

const instanceSvc = new ShelfInstanceService(db)
const performanceSvc = new ShelfPerformanceService(db)

export async function shelfInstancesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/shelf-instances/:id', async (request, reply) => {
    const { id } = request.params
    const detail = await instanceSvc.getShelfInstanceWithItems(id)
    if (!detail) {
      return reply.status(404).send({ error: 'ShelfInstance not found' })
    }
    return reply.send(detail)
  })

  app.get<{
    Params: { profileId: string }
    Querystring: { limit?: string; before?: string }
  }>('/profiles/:profileId/shelf-instances', async (request, reply) => {
    const { profileId } = request.params
    const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 100)
    const before = request.query.before ?? undefined
    const instances = await instanceSvc.listProfileShelfInstances(profileId, limit, before)
    return reply.send(instances)
  })

  app.get<{
    Params: { profileId: string; conceptId: string }
  }>(
    '/profiles/:profileId/shelf-concepts/:conceptId/performance',
    async (request, reply) => {
      const { profileId, conceptId } = request.params
      const performance = await performanceSvc.getConceptPerformance(profileId, conceptId)
      return reply.send(performance)
    },
  )
}
