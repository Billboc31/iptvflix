import type { FastifyInstance } from 'fastify'
import type { CreateSourceBody, UpdateSourceBody } from '@iptvflix/api-contracts'
import {
  createSource,
  listSources,
  getSource,
  updateSource,
  deleteSource,
  testSourceConnection,
  NotFoundError,
} from '../services/source-service.js'

export async function sourcesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateSourceBody }>('/sources', async (request, reply) => {
    const body = request.body
    if (!body?.name || !body?.type || !body?.baseUrl) {
      return reply.status(400).send({ error: 'name, type, and baseUrl are required' })
    }
    if (body.type !== 'XTREAM' && body.type !== 'M3U' && body.type !== 'PLEX') {
      return reply.status(400).send({ error: 'type must be XTREAM, M3U, or PLEX' })
    }
    const source = await createSource(body)
    return reply.status(201).send(source)
  })

  app.get('/sources', async () => {
    return listSources()
  })

  app.get<{ Params: { id: string } }>('/sources/:id', async (request, reply) => {
    try {
      return await getSource(request.params.id)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })

  app.patch<{ Params: { id: string }; Body: UpdateSourceBody }>(
    '/sources/:id',
    async (request, reply) => {
      try {
        return await updateSource(request.params.id, request.body)
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.status(404).send({ error: err.message })
        }
        throw err
      }
    },
  )

  app.delete<{ Params: { id: string } }>('/sources/:id', async (request, reply) => {
    try {
      await deleteSource(request.params.id)
      return reply.status(204).send()
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })

  app.post<{ Params: { id: string } }>('/sources/:id/test', async (request, reply) => {
    try {
      return await testSourceConnection(request.params.id)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })
}
