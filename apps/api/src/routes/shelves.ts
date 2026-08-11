import type { FastifyInstance, FastifyReply } from 'fastify'
import type { CreateShelfBody, UpdateShelfBody, AddShelfMemberBody, ReorderShelfMembersBody } from '@iptvflix/api-contracts'
import {
  listShelves,
  getShelf,
  createShelf,
  updateShelf,
  deleteShelf,
  addMember,
  removeMember,
  reorderMembers,
} from '../services/shelf-service.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'

function handleServiceError(err: unknown, reply: FastifyReply): ReturnType<FastifyReply['send']> {
  if (err instanceof ForbiddenError) return reply.status(403).send({ error: err.message })
  if (err instanceof NotFoundError) return reply.status(404).send({ error: err.message })
  if (err instanceof ValidationError) return reply.status(400).send({ error: err.message, validationError: true })
  throw err
}

export async function shelvesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/shelves', async () => {
    return listShelves(DEFAULT_PROFILE_ID)
  })

  app.post<{ Body: CreateShelfBody }>('/shelves', async (request, reply) => {
    const { title, type, rules, layoutHint } = request.body ?? {}
    if (!title || typeof title !== 'string') {
      return reply.status(400).send({ error: 'title is required' })
    }
    if (type !== 'MANUAL' && type !== 'DYNAMIC') {
      return reply.status(400).send({ error: 'type must be MANUAL or DYNAMIC' })
    }
    if (type === 'DYNAMIC' && !rules) {
      return reply.status(400).send({ error: 'rules are required for DYNAMIC shelves', validationError: true })
    }
    try {
      const summary = await createShelf(DEFAULT_PROFILE_ID, { title, type, rules, layoutHint })
      return reply.status(201).send(summary)
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  app.get<{ Params: { id: string } }>('/shelves/:id', async (request, reply) => {
    try {
      const shelf = await getShelf(request.params.id, DEFAULT_PROFILE_ID)
      return shelf
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  app.patch<{ Params: { id: string }; Body: UpdateShelfBody }>('/shelves/:id', async (request, reply) => {
    try {
      const summary = await updateShelf(request.params.id, DEFAULT_PROFILE_ID, request.body ?? {})
      return summary
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  app.delete<{ Params: { id: string } }>('/shelves/:id', async (request, reply) => {
    try {
      await deleteShelf(request.params.id, DEFAULT_PROFILE_ID)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  app.post<{ Params: { id: string }; Body: AddShelfMemberBody }>(
    '/shelves/:id/members',
    async (request, reply) => {
      const { mediaType, mediaId } = request.body ?? {}
      if (!mediaType || !mediaId) {
        return reply.status(400).send({ error: 'mediaType and mediaId are required' })
      }
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      try {
        await addMember(request.params.id, DEFAULT_PROFILE_ID, { mediaType, mediaId })
        return reply.status(204).send()
      } catch (err) {
        return handleServiceError(err, reply)
      }
    },
  )

  app.delete<{ Params: { id: string; mediaType: string; mediaId: string } }>(
    '/shelves/:id/members/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      try {
        await removeMember(request.params.id, DEFAULT_PROFILE_ID, mediaType, mediaId)
        return reply.status(204).send()
      } catch (err) {
        return handleServiceError(err, reply)
      }
    },
  )

  app.put<{ Params: { id: string }; Body: ReorderShelfMembersBody }>(
    '/shelves/:id/members/order',
    async (request, reply) => {
      const { members } = request.body ?? {}
      if (!Array.isArray(members)) {
        return reply.status(400).send({ error: 'members must be an array' })
      }
      try {
        await reorderMembers(request.params.id, DEFAULT_PROFILE_ID, members)
        return reply.status(204).send()
      } catch (err) {
        return handleServiceError(err, reply)
      }
    },
  )
}
