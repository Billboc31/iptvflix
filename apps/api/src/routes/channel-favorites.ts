import { eq, and } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ChannelResponse } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { channelFavorites } from '../db/schema/channel-favorites.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'

export async function channelFavoritesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: ChannelResponse[] }>('/channels/favorites', async (req, reply) => {
    const profileId = req.profileId!

    const rows = await db
      .selectDistinct({
        id: channels.id,
        canonicalName: channels.canonicalName,
        logoUrl: channels.logoUrl,
        categories: channels.categories,
      })
      .from(channelFavorites)
      .innerJoin(channels, eq(channelFavorites.channelId, channels.id))
      .innerJoin(channelSources, and(
        eq(channelSources.channelId, channels.id),
        eq(channelSources.status, 'AVAILABLE'),
      ))
      .where(eq(channelFavorites.profileId, profileId))
      .orderBy(channels.canonicalName)

    return reply.send(
      rows.map((row) => ({
        id: row.id,
        name: row.canonicalName,
        logoUrl: row.logoUrl ?? null,
        categories: (row.categories as string[]) ?? [],
        isFavorite: true,
      })),
    )
  })

  app.post<{ Params: { id: string } }>('/channels/:id/favorite', async (req, reply) => {
    const profileId = req.profileId!
    const channelId = req.params.id

    await db
      .insert(channelFavorites)
      .values({ profileId, channelId })
      .onConflictDoNothing()

    return reply.status(204).send()
  })

  app.delete<{ Params: { id: string } }>('/channels/:id/favorite', async (req, reply) => {
    const profileId = req.profileId!
    const channelId = req.params.id

    await db
      .delete(channelFavorites)
      .where(
        and(
          eq(channelFavorites.profileId, profileId),
          eq(channelFavorites.channelId, channelId),
        ),
      )

    return reply.status(204).send()
  })
}
