import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type {
  ChannelResponse,
  ChannelStreamResponse,
  ChannelPlaybackResponse,
  GuideChannelResponse,
  LiveSearchResponse,
} from '@iptvflix/api-contracts'
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
import { ensureEpgLoaded, getEpgNowNext, getEpgProgramsInWindow } from '../services/epg-service.js'
import { resolveChannelPlayback } from '../services/channel-playback-resolver.js'
import { resolveClientType } from './resolve-client-type.js'
import { requireProfile } from '../plugins/auth.js'
import { normalizeQuery } from '../services/live-search-normalizer.js'
import { searchLiveTV } from '../services/live-search-service.js'

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

function normalizeCountryFilter(code: string): string {
  const upper = code.trim().toUpperCase()
  return upper === 'UK' ? 'GB' : upper
}

/** Curated country match: registry country, language, beIN, GB/UK alias. */
function matchesCuratedCountry(
  channel: { country: string | null; language: string | null; iptvOrgId: string | null },
  countryFilter: string,
): boolean {
  const filter = normalizeCountryFilter(countryFilter)
  const channelCountry = channel.country ? normalizeCountryFilter(channel.country) : null

  if (channelCountry === filter) return true

  if (filter === 'FR') {
    if (channel.language === 'fr') return true
    if (channel.iptvOrgId?.match(/^beINSports/i)) return true
  }

  if (filter === 'GB') {
    if (channel.language === 'en') return true
    if (channelCountry === 'UK') return true
  }

  return false
}

async function buildChannelList(
  req: { profileId?: string; query: Record<string, string | undefined> },
  opts?: { includePrograms?: boolean; programHours?: number },
): Promise<ChannelResponse[] | GuideChannelResponse[]> {
  const profileId = req.profileId

  const availableIds = await db
    .selectDistinct({ id: channelSources.channelId })
    .from(channelSources)
    .where(eq(channelSources.status, 'AVAILABLE'))

  if (availableIds.length === 0) return []

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
      if (ids.length === 0) return []
    }
  }

  const langFilter = req.query.lang ? normalizeLangCode(req.query.lang) : null
  const catalogMode = req.query.catalog === 'all' ? 'all' : 'curated'
  const countryFilter = normalizeCountryFilter(
    req.query.country || (catalogMode === 'curated' ? preferredCountry : ''),
  )

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

  let mapped: ChannelResponse[] = rows.map((row) => ({
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
      mapped = mapped.filter((c) =>
        matchesCuratedCountry(
          {
            country: c.country ?? null,
            language: c.language ?? null,
            iptvOrgId: c.iptvOrgId ?? null,
          },
          countryFilter,
        ),
      )
    }
  } else if (countryFilter && req.query.country) {
    mapped = mapped.filter((c) => normalizeCountryFilter(c.country ?? '') === countryFilter)
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

  const epgCache = await ensureEpgLoaded()
  mapped = mapped.map((ch) => {
    if (!ch.iptvOrgId) return ch
    const epg = getEpgNowNext(ch.iptvOrgId, epgCache)
    if (!epg.now && !epg.next) return ch
    return { ...ch, epg }
  })

  if (opts?.includePrograms) {
    const hours = opts.programHours ?? 6
    return mapped.map((ch) => ({
      ...ch,
      programs: ch.iptvOrgId ? getEpgProgramsInWindow(ch.iptvOrgId, epgCache, hours) : [],
    }))
  }

  return mapped
}

export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { favorites?: string; lang?: string; country?: string; catalog?: string }
    Reply: ChannelResponse[]
  }>('/channels', async (req, reply) => {
    const mapped = await buildChannelList(req)
    return reply.send(mapped)
  })

  app.get<{
    Querystring: { country?: string; catalog?: string; hours?: string }
    Reply: GuideChannelResponse[]
  }>('/channels/guide', async (req, reply) => {
    const hours = Math.min(24, Math.max(1, Number(req.query.hours) || 6))
    const mapped = await buildChannelList(req, { includePrograms: true, programHours: hours })
    return reply.send(mapped as GuideChannelResponse[])
  })

  app.get<{
    Querystring: { q?: string }
    Reply: LiveSearchResponse
  }>('/channels/search', async (req, reply) => {
    const raw = req.query.q
    if (!raw || raw.trim().length === 0) {
      return reply.status(400).send({ liveNow: [], upcoming: [], channels: [] } as LiveSearchResponse)
    }
    if (raw.length > 100) {
      return reply.status(400).send({ liveNow: [], upcoming: [], channels: [] } as LiveSearchResponse)
    }
    const query = normalizeQuery(raw)
    if (!query) {
      return reply.send({ liveNow: [], upcoming: [], channels: [] })
    }
    const epgCache = await ensureEpgLoaded()
    const result = await searchLiveTV(query, epgCache)
    return reply.send(result)
  })

  app.post<{ Params: { id: string }; Reply: ChannelPlaybackResponse }>(
    '/channels/:id/playback/resolve',
    { preHandler: requireProfile },
    async (req, reply) => {
      const correlationId = randomUUID()
      reply.header('X-Correlation-ID', correlationId)
      try {
        const clientType = resolveClientType(req)
        const session = await resolveChannelPlayback(
          req.profileId!,
          req.params.id,
          correlationId,
          { clientType },
        )
        return reply.send(session)
      } catch {
        return reply.status(404).send({
          gatewayUrl: '',
          deliveryMode: 'DIRECT',
          containerExtension: 'ts',
          correlationId,
        } as ChannelPlaybackResponse)
      }
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
