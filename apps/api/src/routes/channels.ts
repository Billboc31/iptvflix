import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ChannelResponse, ChannelStreamResponse } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { channelFavorites } from '../db/schema/channel-favorites.js'
import { profiles } from '../db/schema/profiles.js'
import { selectPreferredSources } from '../channels/source-selector.js'
import {
  CATEGORY_DISPLAY_ORDER,
  mapCategory,
  type CanonicalCategory,
} from '../channels/category-mapper.js'
import { languageToPreferredCountry } from '../channels/iptv-org-matcher.js'
import { lcnRank } from '../channels/lcn-order.js'

function normalizeLangCode(code: string): string {
  return code.trim().toLowerCase().slice(0, 2)
}

function canonicalizeCategories(raw: string[] | null | undefined): string[] {
  const mapped = (raw ?? []).map((c) => mapCategory(c))
  const unique = [...new Set(mapped)]
  return unique.length > 0 ? unique : ['other']
}

function categoryRank(cats: string[]): number {
  const primary = cats[0] as CanonicalCategory | undefined
  if (!primary) return CATEGORY_DISPLAY_ORDER.length
  const idx = CATEGORY_DISPLAY_ORDER.indexOf(primary)
  return idx === -1 ? CATEGORY_DISPLAY_ORDER.length : idx
}

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { favorites?: string; lang?: string; country?: string; catalog?: string }
    Reply: ChannelResponse[]
  }>('/channels', async (req, reply) => {
    const profileId = req.profileId

    const availableIds = await db
      .selectDistinct({ id: channelSources.channelId })
      .from(channelSources)
      .where(eq(channelSources.status, 'AVAILABLE'))

    if (availableIds.length === 0) return reply.send([])

    let ids = availableIds.map((r) => r.id)

    let favoriteChannelIds: Set<string> | null = null
    let preferredLangs: string[] = ['fr']
    let preferredCountry = 'FR'

    if (profileId) {
      const [profile] = await db
        .select({
          preferredAudioLanguages: profiles.preferredAudioLanguages,
        })
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1)

      if (profile?.preferredAudioLanguages?.length) {
        preferredLangs = profile.preferredAudioLanguages.map(normalizeLangCode).filter(Boolean)
        preferredCountry = languageToPreferredCountry(preferredLangs)
      }

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

    const langFilter = req.query.lang ? normalizeLangCode(req.query.lang) : null
    const catalogMode = req.query.catalog === 'all' ? 'all' : 'curated'
    const countryFilter = (req.query.country || (catalogMode === 'curated' ? preferredCountry : ''))
      .trim()
      .toUpperCase()

    const rows = await db
      .select({
        id: channels.id,
        canonicalName: channels.canonicalName,
        logoUrl: channels.logoUrl,
        categories: channels.categories,
        language: channels.language,
        country: channels.country,
        iptvOrgId: channels.iptvOrgId,
      })
      .from(channels)
      .where(inArray(channels.id, ids))

    let mapped = rows.map((row) => ({
      id: row.id,
      name: row.canonicalName,
      logoUrl: row.logoUrl ?? null,
      categories: canonicalizeCategories(row.categories as string[] | null),
      language: row.language ? normalizeLangCode(row.language) : null,
      country: row.country ? row.country.toUpperCase() : null,
      iptvOrgId: row.iptvOrgId ?? null,
      isFavorite: favoriteChannelIds ? favoriteChannelIds.has(row.id) : undefined,
    }))

    if (catalogMode === 'curated') {
      mapped = mapped.filter((c) => c.iptvOrgId)
      if (countryFilter) {
        mapped = mapped.filter((c) => c.country === countryFilter)
      }
    } else if (countryFilter && req.query.country) {
      mapped = mapped.filter((c) => c.country === countryFilter)
    }

    if (langFilter) {
      mapped = mapped.filter((c) => c.language === langFilter)
    }

    mapped.sort((a, b) => {
      if (catalogMode === 'curated') {
        const la = lcnRank(a.iptvOrgId, a.country)
        const lb = lcnRank(b.iptvOrgId, b.country)
        if (la !== lb) return la - lb
        return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      }

      const aMatch = a.language && preferredLangs.includes(a.language) ? 0 : 1
      const bMatch = b.language && preferredLangs.includes(b.language) ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      const ca = categoryRank(a.categories)
      const cb = categoryRank(b.categories)
      if (ca !== cb) return ca - cb
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    })

    return reply.send(mapped)
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
