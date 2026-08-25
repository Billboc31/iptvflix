import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ChannelResponse, ChannelStreamResponse } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { channelFavorites } from '../db/schema/channel-favorites.js'
import { selectPreferredSources } from '../channels/source-selector.js'

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { favorites?: string }; Reply: ChannelResponse[] }>(
    '/channels',
    async (req, reply) => {
      const profileId = req.profileId

      const availableIds = await db
        .selectDistinct({ id: channelSources.channelId })
        .from(channelSources)
        .where(eq(channelSources.status, 'AVAILABLE'))

      if (availableIds.length === 0) return reply.send([])

      let ids = availableIds.map((r) => r.id)

      // Resolve favorites for isFavorite field and optional filter
      let favoriteChannelIds: Set<string> | null = null
      if (profileId) {
        const favRows = await db
          .select({ channelId: channelFavorites.channelId })
          .from(channelFavorites)
          .where(eq(channelFavorites.profileId, profileId))
        favoriteChannelIds = new Set(favRows.map((r) => r.channelId))

        if (req.query.favorites === '1') {
          ids = ids.filter((id) => favoriteChannelIds!.has(id))
          if (ids.length === 0) return reply.send([])
        }
      }

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
          isFavorite: favoriteChannelIds ? favoriteChannelIds.has(row.id) : undefined,
        })),
      )
    },
  )

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
