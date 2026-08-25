import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ChannelResponse, ChannelStreamResponse } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { selectPreferredSources } from '../channels/source-selector.js'

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: ChannelResponse[] }>('/channels', async (_req, reply) => {
    const availableIds = await db
      .selectDistinct({ id: channelSources.channelId })
      .from(channelSources)
      .where(eq(channelSources.status, 'AVAILABLE'))

    if (availableIds.length === 0) return reply.send([])

    const ids = availableIds.map((r) => r.id)
    const rows = await db
      .select({
        id: channels.id,
        canonicalName: channels.canonicalName,
        logoUrl: channels.logoUrl,
        categories: channels.categories,
      })
      .from(channels)
      .where(inArray(channels.id, ids))
      .orderBy(channels.canonicalName)

    return reply.send(
      rows.map((row) => ({
        id: row.id,
        name: row.canonicalName,
        logoUrl: row.logoUrl ?? null,
        categories: (row.categories as string[]) ?? [],
      })),
    )
  })

  app.get<{ Params: { id: string }; Reply: ChannelStreamResponse }>(
    '/channels/:id/stream',
    async (req, reply) => {
      const rows = await db
        .select({
          id: channelSources.id,
          channelId: channelSources.channelId,
          sourceId: channelSources.sourceId,
          streamUrl: channelSources.streamUrl,
          priority: channelSources.priority,
          status: channelSources.status,
          lastSeenAt: channelSources.lastSeenAt,
        })
        .from(channelSources)
        .where(eq(channelSources.channelId, req.params.id))

      const ordered = selectPreferredSources(
        rows.map((r) => ({
          ...r,
          status: r.status as 'AVAILABLE' | 'UNAVAILABLE',
        })),
      )

      const primary = ordered.find((s) => s.status === 'AVAILABLE')
      if (!primary) {
        return reply.status(404).send({ streamUrl: '' } as ChannelStreamResponse)
      }

      return reply.send({ streamUrl: primary.streamUrl })
    },
  )
}
