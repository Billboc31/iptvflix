import type { FastifyInstance } from 'fastify'
import type { ChannelResponse } from '@iptvflix/api-contracts'

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: ChannelResponse[] }>('/channels', async (_req, reply) => {
    return reply.send([])
  })
}
