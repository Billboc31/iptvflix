import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { normalizeChannelName, toCanonicalDisplayName } from '../channels/channel-normalizer.js'
import { mapCategory, mapIptvOrgCategories } from '../channels/category-mapper.js'
import { inferChannelLanguage } from '../channels/language-infer.js'
import { loadIptvOrgCatalog } from '../channels/iptv-org-catalog.js'
import {
  inferChannelCountry,
} from '../channels/iptv-org-matcher.js'
import { loadXmltvFrCatalog } from '../channels/xmltv-fr-catalog.js'
import {
  matchCatalogChannel,
  type CatalogMatch,
} from '../channels/catalog-matcher.js'
import type { IptvOrgIndex } from '../channels/iptv-org-catalog.js'
import type { XmltvFrIndex } from '../channels/xmltv-fr-catalog.js'

export interface LiveChannelEntry {
  providerItemId: string
  providerName: string
  streamUrl: string
  tvgId?: string | null
  tvgLogo?: string | null
  groupTitle?: string | null
  priority?: number
}

export interface ChannelSyncResult {
  channelsCreated: number
  channelsUpdated: number
  sourcesCreated: number
  sourcesUpdated: number
  unavailableCount: number
}

type ChannelRow = typeof channels.$inferSelect
type ChannelSourceRow = typeof channelSources.$inferSelect

const CONFIDENCE_MERGE_THRESHOLD = 0.75
/** Unique normalized-name match (quality variants HD/FHD/4K) when no conflicting tvgId. */
const CONFIDENCE_NAME_ONLY_MERGE = 0.4

function computeConfidence(
  entryTvgId: string | null | undefined,
  entryNormalized: string,
  candidate: ChannelRow,
): { confidence: number; provenance: Record<string, unknown> } {
  const provenance: Record<string, unknown> = { candidateId: candidate.id }

  // Different stable EPG ids → never merge (even if display names collide).
  if (entryTvgId && candidate.tvgId && entryTvgId !== candidate.tvgId) {
    provenance.tvgIdConflict = true
    provenance.finalConfidence = 0
    return { confidence: 0, provenance }
  }

  let confidence = 0

  if (entryTvgId && candidate.tvgId && entryTvgId === candidate.tvgId) {
    confidence += 0.6
    provenance.tvgIdMatch = true
  }

  if (entryNormalized && candidate.normalizedName && entryNormalized === candidate.normalizedName) {
    confidence += 0.4
    provenance.normalizedNameMatch = true
  }

  provenance.finalConfidence = confidence
  return { confidence, provenance }
}

function pickMergeCandidate<T extends { confidence: number; provenance: Record<string, unknown> }>(
  scored: T[],
): T | null {
  const strong = scored.filter((c) => c.confidence >= CONFIDENCE_MERGE_THRESHOLD)
  if (strong.length === 1) return strong[0]!
  if (strong.length > 1) return null

  const nameOnly = scored.filter(
    (c) =>
      c.confidence >= CONFIDENCE_NAME_ONLY_MERGE &&
      c.provenance.normalizedNameMatch === true &&
      !c.provenance.tvgIdConflict,
  )
  if (nameOnly.length === 1) return nameOnly[0]!
  return null
}

function applyCatalogEnrichment(
  patch: Partial<typeof channels.$inferInsert>,
  current: {
    iptvOrgId?: string | null
    country?: string | null
    logoUrl?: string | null
    canonicalName?: string | null
    categories?: string[] | null
  },
  catalog: CatalogMatch | null,
  countryFallback: string | null,
): boolean {
  let changed = false
  const broadcastCountry = countryFallback?.toUpperCase() ?? null

  if (catalog) {
    if (current.iptvOrgId !== catalog.id) {
      patch.iptvOrgId = catalog.id
      changed = true
    }
    const resolvedCountry = broadcastCountry ?? catalog.country ?? null
    if (resolvedCountry && current.country !== resolvedCountry) {
      patch.country = resolvedCountry
      changed = true
    }
    if (catalog.logoUrl && !current.logoUrl) {
      patch.logoUrl = catalog.logoUrl
      changed = true
    }
    if (catalog.name && current.canonicalName !== catalog.name) {
      patch.canonicalName = catalog.name
      changed = true
    }
    if (catalog.source === 'iptv-org' && catalog.categories?.length) {
      const cats = mapIptvOrgCategories(catalog.categories)
      const prev = (current.categories as string[] | null) ?? []
      if (prev[0] !== cats[0]) {
        patch.categories = cats
        changed = true
      }
    }
  } else if (broadcastCountry && !current.country) {
    patch.country = broadcastCountry
    changed = true
  }
  return changed
}

export const ChannelSyncService = {
  async syncLiveChannels(
    sourceId: string,
    entries: LiveChannelEntry[],
    opts?: { skipLifecycle?: boolean },
  ): Promise<ChannelSyncResult> {
    const result: ChannelSyncResult = {
      channelsCreated: 0,
      channelsUpdated: 0,
      sourcesCreated: 0,
      sourcesUpdated: 0,
      unavailableCount: 0,
    }

    if (entries.length === 0 && !opts?.skipLifecycle) {
      return result
    }

    const now = new Date()

    let iptvOrgIndex: IptvOrgIndex | null = null
    let xmltvIndex: XmltvFrIndex | null = null
    try {
      ;[iptvOrgIndex, xmltvIndex] = await Promise.all([
        loadIptvOrgCatalog(),
        loadXmltvFrCatalog(),
      ])
    } catch {
      iptvOrgIndex = null
      xmltvIndex = null
    }

    const resolveCatalog = (
      providerName: string,
      groupTitle?: string | null,
      tvgId?: string | null,
    ) =>
      matchCatalogChannel(iptvOrgIndex, xmltvIndex, providerName, {
        groupTitle,
        tvgId,
      })

    const existingSources = await db
      .select()
      .from(channelSources)
      .where(and(eq(channelSources.sourceId, sourceId), eq(channelSources.status, 'AVAILABLE')))

    const existingSourcesByItemId = new Map<string, ChannelSourceRow>()
    for (const row of existingSources) {
      existingSourcesByItemId.set(row.providerItemId, row)
    }

    const allChannels = await db.select().from(channels)
    const channelsByTvgId = new Map<string, ChannelRow[]>()
    const channelsByNormalizedName = new Map<string, ChannelRow[]>()

    for (const ch of allChannels) {
      if (ch.tvgId) {
        const arr = channelsByTvgId.get(ch.tvgId) ?? []
        arr.push(ch)
        channelsByTvgId.set(ch.tvgId, arr)
      }
      const arr = channelsByNormalizedName.get(ch.normalizedName) ?? []
      arr.push(ch)
      channelsByNormalizedName.set(ch.normalizedName, arr)
    }

    const seenProviderItemIds = new Set<string>()

    for (const entry of entries) {
      seenProviderItemIds.add(entry.providerItemId)

      const existing = existingSourcesByItemId.get(entry.providerItemId)
      if (existing) {
        await db
          .update(channelSources)
          .set({ lastSeenAt: now, status: 'AVAILABLE', unavailableAt: null })
          .where(eq(channelSources.id, existing.id))
        result.sourcesUpdated++

        const language = inferChannelLanguage(entry.providerName, entry.groupTitle)
        const categories = entry.groupTitle ? [mapCategory(entry.groupTitle)] : []
        const catalog = resolveCatalog(entry.providerName, entry.groupTitle, entry.tvgId)
        const countryFallback = inferChannelCountry(entry.providerName, entry.groupTitle, language)
        const [chRow] = await db
          .select({
            logoUrl: channels.logoUrl,
            language: channels.language,
            categories: channels.categories,
            country: channels.country,
            iptvOrgId: channels.iptvOrgId,
            canonicalName: channels.canonicalName,
          })
          .from(channels)
          .where(eq(channels.id, existing.channelId))
          .limit(1)

        if (chRow) {
          const patch: Partial<typeof channels.$inferInsert> = { updatedAt: now }
          let changed = false
          if (entry.tvgLogo && !chRow.logoUrl) {
            patch.logoUrl = entry.tvgLogo
            changed = true
          }
          if (language && chRow.language !== language) {
            patch.language = language
            changed = true
          }
          if (categories.length > 0) {
            const prev = (chRow.categories as string[] | null) ?? []
            if (prev[0] !== categories[0]) {
              patch.categories = categories
              changed = true
            }
          }
          if (applyCatalogEnrichment(patch, chRow, catalog, countryFallback)) changed = true
          if (changed) {
            await db.update(channels).set(patch).where(eq(channels.id, existing.channelId))
            result.channelsUpdated++
          }
        }
        continue
      }

      const entryNormalized = normalizeChannelName(entry.providerName)

      const candidateSet = new Map<string, ChannelRow>()
      if (entry.tvgId) {
        for (const ch of channelsByTvgId.get(entry.tvgId) ?? []) {
          candidateSet.set(ch.id, ch)
        }
      }
      for (const ch of channelsByNormalizedName.get(entryNormalized) ?? []) {
        candidateSet.set(ch.id, ch)
      }

      const scoredCandidates = [...candidateSet.values()].map((ch) => ({
        channel: ch,
        ...computeConfidence(entry.tvgId, entryNormalized, ch),
      }))
      const match = pickMergeCandidate(scoredCandidates)

      if (match) {
        const channelId = match.channel.id
        const language = inferChannelLanguage(entry.providerName, entry.groupTitle)
        const categories = entry.groupTitle ? [mapCategory(entry.groupTitle)] : []
        const catalog = resolveCatalog(entry.providerName, entry.groupTitle, entry.tvgId)
        const countryFallback = inferChannelCountry(entry.providerName, entry.groupTitle, language)

        const patch: Partial<typeof channels.$inferInsert> = { updatedAt: now }
        let changed = false
        if (entry.tvgLogo && !match.channel.logoUrl) {
          patch.logoUrl = entry.tvgLogo
          match.channel.logoUrl = entry.tvgLogo
          changed = true
        }
        if (language && match.channel.language !== language) {
          patch.language = language
          match.channel.language = language
          changed = true
        }
        if (categories.length > 0) {
          const prev = (match.channel.categories as string[] | null) ?? []
          if (prev[0] !== categories[0]) {
            patch.categories = categories
            match.channel.categories = categories
            changed = true
          }
        }
        if (
          applyCatalogEnrichment(
            patch,
            match.channel,
            catalog,
            countryFallback,
          )
        ) {
          if (patch.iptvOrgId) match.channel.iptvOrgId = patch.iptvOrgId
          if (patch.country) match.channel.country = patch.country
          if (patch.logoUrl) match.channel.logoUrl = patch.logoUrl
          if (patch.canonicalName) match.channel.canonicalName = patch.canonicalName
          changed = true
        }
        if (changed) {
          await db.update(channels).set(patch).where(eq(channels.id, channelId))
          result.channelsUpdated++
        }

        await db
          .insert(channelSources)
          .values({
            channelId,
            sourceId,
            providerItemId: entry.providerItemId,
            providerName: entry.providerName,
            streamUrl: entry.streamUrl,
            tvgId: entry.tvgId ?? null,
            tvgLogo: entry.tvgLogo ?? null,
            groupTitle: entry.groupTitle ?? null,
            priority: entry.priority ?? 0,
            matchConfidence: match.confidence,
            matchProvenance: match.provenance,
            status: 'AVAILABLE',
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoNothing({ target: [channelSources.sourceId, channelSources.providerItemId] })
        result.sourcesCreated++
      } else {
        const canonicalName = toCanonicalDisplayName(entryNormalized) || entry.providerName
        const language = inferChannelLanguage(entry.providerName, entry.groupTitle)
        const catalog = resolveCatalog(entry.providerName, entry.groupTitle, entry.tvgId)
        const countryFallback = inferChannelCountry(entry.providerName, entry.groupTitle, language)
        const country =
          countryFallback ??
          catalog?.country ??
          inferChannelCountry(entry.providerName, entry.groupTitle, language)
        const categories = catalog?.source === 'iptv-org' && catalog.categories?.length
          ? mapIptvOrgCategories(catalog.categories)
          : entry.groupTitle
            ? [mapCategory(entry.groupTitle)]
            : ['other']

        const [newChannel] = await db
          .insert(channels)
          .values({
            canonicalName: catalog?.name ?? canonicalName,
            normalizedName: entryNormalized,
            logoUrl: entry.tvgLogo ?? catalog?.logoUrl ?? null,
            tvgId: entry.tvgId ?? null,
            categories,
            language,
            country,
            iptvOrgId: catalog?.id ?? null,
          })
          .returning()

        if (!newChannel) continue
        const channelId = newChannel.id

        if (newChannel.tvgId) {
          const arr = channelsByTvgId.get(newChannel.tvgId) ?? []
          arr.push(newChannel)
          channelsByTvgId.set(newChannel.tvgId, arr)
        }
        const nameArr = channelsByNormalizedName.get(newChannel.normalizedName) ?? []
        nameArr.push(newChannel)
        channelsByNormalizedName.set(newChannel.normalizedName, nameArr)

        await db
          .insert(channelSources)
          .values({
            channelId,
            sourceId,
            providerItemId: entry.providerItemId,
            providerName: entry.providerName,
            streamUrl: entry.streamUrl,
            tvgId: entry.tvgId ?? null,
            tvgLogo: entry.tvgLogo ?? null,
            groupTitle: entry.groupTitle ?? null,
            priority: entry.priority ?? 0,
            matchConfidence: 1.0,
            matchProvenance: { reason: 'new_canonical', normalizedName: entryNormalized },
            status: 'AVAILABLE',
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoNothing({ target: [channelSources.sourceId, channelSources.providerItemId] })

        result.channelsCreated++
        result.sourcesCreated++
      }
    }

    if (!opts?.skipLifecycle) {
      const missingProviderItemIds = [...existingSourcesByItemId.keys()].filter(
        (id) => !seenProviderItemIds.has(id),
      )

      if (missingProviderItemIds.length > 0) {
        await db
          .update(channelSources)
          .set({ status: 'UNAVAILABLE', unavailableAt: now })
          .where(
            and(
              eq(channelSources.sourceId, sourceId),
              eq(channelSources.status, 'AVAILABLE'),
              inArray(channelSources.providerItemId, missingProviderItemIds),
            ),
          )
        result.unavailableCount += missingProviderItemIds.length
      }
    }

    return result
  },
}
