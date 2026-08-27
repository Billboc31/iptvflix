import { eq, inArray, or, sql, and, desc } from 'drizzle-orm'
import { db as globalDb } from '../db/client.js'
import { channels } from '../db/schema/channels.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { searchEpgPrograms, type EpgCache } from './epg-service.js'
import type { LiveSearchResponse, LiveNowResult, UpcomingResult, ChannelResult } from '@iptvflix/api-contracts'

type DbClient = typeof globalDb

const MAX_UPCOMING_OCCURRENCES = 3

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function titleRank(title: string, query: string): number {
  const n = normalizeText(title)
  if (n === query) return 0
  if (n.startsWith(query)) return 1
  return 2
}

export async function searchLiveTV(
  query: string,
  epgCache: EpgCache | null,
  dbClient: DbClient = globalDb,
): Promise<LiveSearchResponse> {
  if (!query) return { liveNow: [], upcoming: [], channels: [] }

  const now = new Date()

  // 1. EPG search (pure, no DB) — sort by match quality then start time
  const epgMatches = searchEpgPrograms(query, epgCache, now).sort((a, b) => {
    if (a.matchWeight !== b.matchWeight) return a.matchWeight - b.matchWeight
    return a.startTime.localeCompare(b.startTime)
  })

  const catalogIds = [...new Set(epgMatches.map((m) => m.catalogId))]

  // 2. Fetch channels matching by name OR referenced by EPG catalog ID (one query)
  const namePattern = `%${query}%`
  const nameConditions = [
    sql`unaccent(lower(${channels.canonicalName})) ILIKE unaccent(lower(${namePattern}))`,
    sql`unaccent(lower(${channels.normalizedName})) ILIKE unaccent(lower(${namePattern}))`,
  ]
  const whereClause =
    catalogIds.length > 0
      ? or(...nameConditions, inArray(channels.iptvOrgId, catalogIds))
      : or(...nameConditions)

  const channelRows = await dbClient
    .select({
      id: channels.id,
      canonicalName: channels.canonicalName,
      normalizedName: channels.normalizedName,
      logoUrl: channels.logoUrl,
      categories: channels.categories,
      language: channels.language,
      country: channels.country,
      iptvOrgId: channels.iptvOrgId,
    })
    .from(channels)
    .where(whereClause)

  const channelByIptvOrgId = new Map(
    channelRows.filter((r) => r.iptvOrgId).map((r) => [r.iptvOrgId!, r]),
  )

  // 3. Fetch best available source for each channel with a live program
  const liveMatches = epgMatches.filter((m) => m.isLive)
  const liveChannelIds = [
    ...new Set(
      liveMatches.map((m) => channelByIptvOrgId.get(m.catalogId)?.id).filter((id): id is string => !!id),
    ),
  ]

  const sourceByChannelId = new Map<string, string>()
  if (liveChannelIds.length > 0) {
    const sourceRows = await dbClient
      .select({
        channelId: channelSources.channelId,
        streamUrl: channelSources.streamUrl,
        priority: channelSources.priority,
      })
      .from(channelSources)
      .where(
        and(inArray(channelSources.channelId, liveChannelIds), eq(channelSources.status, 'AVAILABLE')),
      )
      .orderBy(desc(channelSources.priority))

    for (const row of sourceRows) {
      if (!sourceByChannelId.has(row.channelId)) {
        sourceByChannelId.set(row.channelId, row.streamUrl)
      }
    }
  }

  // 4. Build LIVE_NOW — deduplicate per channel: keep best-ranked match
  const liveNowMap = new Map<string, LiveNowResult>()
  for (const match of liveMatches) {
    const channel = channelByIptvOrgId.get(match.catalogId)
    if (!channel) continue
    const existing = liveNowMap.get(channel.id)
    if (existing && titleRank(existing.programTitle, query) <= match.matchWeight) continue

    const startMs = new Date(match.startTime).getTime()
    const endMs = new Date(match.endTime).getTime()
    const nowMs = now.getTime()
    const duration = endMs - startMs
    const progress = duration > 0 ? Math.min(1, Math.max(0, (nowMs - startMs) / duration)) : 0

    liveNowMap.set(channel.id, {
      channelId: channel.id,
      channelName: channel.canonicalName,
      logoUrl: channel.logoUrl ?? null,
      programTitle: match.title,
      startTime: match.startTime,
      endTime: match.endTime,
      progress,
      streamUrl: sourceByChannelId.get(channel.id) ?? '',
      deliveryMode: 'DIRECT',
    })
  }

  // 5. Build UPCOMING — deduplicate repeated occurrences (same channel+title, cap at 3)
  const upcomingCounts = new Map<string, number>()
  const upcoming: UpcomingResult[] = []
  const liveNowChannelIds = new Set(liveNowMap.keys())

  for (const match of epgMatches.filter((m) => !m.isLive)) {
    const channel = channelByIptvOrgId.get(match.catalogId)
    if (!channel) continue
    const key = `${channel.id}::${normalizeText(match.title)}`
    const count = upcomingCounts.get(key) ?? 0
    if (count >= MAX_UPCOMING_OCCURRENCES) continue
    upcomingCounts.set(key, count + 1)
    upcoming.push({
      channelId: channel.id,
      channelName: channel.canonicalName,
      logoUrl: channel.logoUrl ?? null,
      programTitle: match.title,
      startTime: match.startTime,
      endTime: match.endTime,
    })
  }

  // 6. Build CHANNEL — name-matched channels not already in LIVE_NOW
  const q = normalizeText(query)
  const channelResults: Array<ChannelResult & { rank: number }> = []

  for (const row of channelRows) {
    if (liveNowChannelIds.has(row.id)) continue
    const canonNorm = normalizeText(row.canonicalName)
    const normNorm = normalizeText(row.normalizedName ?? '')
    if (!canonNorm.includes(q) && !normNorm.includes(q)) continue

    let rank = 2
    if (canonNorm === q) rank = 0
    else if (canonNorm.startsWith(q)) rank = 1

    channelResults.push({
      channelId: row.id,
      channelName: row.canonicalName,
      logoUrl: row.logoUrl ?? null,
      categories: (row.categories as string[]) ?? [],
      language: row.language ?? null,
      country: row.country ?? null,
      rank,
    })
  }

  channelResults.sort(
    (a, b) =>
      a.rank - b.rank || a.channelName.localeCompare(b.channelName, 'fr', { sensitivity: 'base' }),
  )

  const liveNow = [...liveNowMap.values()].sort(
    (a, b) => titleRank(a.programTitle, query) - titleRank(b.programTitle, query),
  )

  return {
    liveNow,
    upcoming,
    channels: channelResults.map(({ rank: _r, ...r }) => r),
  }
}
