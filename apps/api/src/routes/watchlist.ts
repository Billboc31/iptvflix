import type { FastifyInstance } from 'fastify'
import type { AddToWatchlistBody, WatchlistMediaType } from '@iptvflix/api-contracts'
import { addToWatchlist, removeFromWatchlist, listWatchlist } from '../services/watchlist-service.js'
import { NotFoundError } from '../errors.js'

export async function watchlistRoutes(app: FastifyInstance): Promise<void> {
  app.get('/watchlist', async (request) => {
    return listWatchlist(request.profileId!)
  })

  app.post<{ Body: AddToWatchlistBody }>('/watchlist', async (request, reply) => {
    const { mediaType, mediaId } = request.body ?? {}
    if (!mediaType || !mediaId) {
      return reply.status(400).send({ error: 'mediaType and mediaId are required' })
    }
    if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
      return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
    }
    try {
      const entry = await addToWatchlist(request.profileId!, mediaType, mediaId)
      return reply.status(201).send(entry)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })

  app.delete<{ Params: { mediaType: string; mediaId: string } }>(
    '/watchlist/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params
      if (mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
        return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
      }
      await removeFromWatchlist(request.profileId!, mediaType as WatchlistMediaType, mediaId)
      return reply.status(204).send()
    },
  )
}
