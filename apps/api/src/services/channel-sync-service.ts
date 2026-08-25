import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { normalizeChannelName, toCanonicalDisplayName } from '../channels/channel-normalizer.js'
import { mapCategory } from '../channels/category-mapper.js'
import { inferChannelLanguage } from '../channels/language-infer.js'

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

function computeConfidence(
  entryTvgId: string | null | undefined,
  entryNormalized: string,
  candidate: ChannelRow,
): { confidence: number; provenance: Record<string, unknown> } {
  let confidence = 0
  const provenance: Record<string, unknown> = { candidateId: candidate.id }

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
        const [chRow] = await db
          .select({ logoUrl: channels.logoUrl, language: channels.language, categories: channels.categories })
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

      const scoredCandidates = [...candidateSet.values()]
        .map((ch) => ({ channel: ch, ...computeConfidence(entry.tvgId, entryNormalized, ch) }))
        .filter((c) => c.confidence >= CONFIDENCE_MERGE_THRESHOLD)

      if (scoredCandidates.length === 1) {
        const match = scoredCandidates[0]!
        const channelId = match.channel.id
        const language = inferChannelLanguage(entry.providerName, entry.groupTitle)
        const categories = entry.groupTitle ? [mapCategory(entry.groupTitle)] : []

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
        const categories = entry.groupTitle ? [mapCategory(entry.groupTitle)] : ['other']
        const language = inferChannelLanguage(entry.providerName, entry.groupTitle)

        const [newChannel] = await db
          .insert(channels)
          .values({
            canonicalName,
            normalizedName: entryNormalized,
            logoUrl: entry.tvgLogo ?? null,
            tvgId: entry.tvgId ?? null,
            categories,
            language,
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
