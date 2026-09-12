import type { EpisodeSegmentItem, SegmentType } from '@iptvflix/api-contracts'

/** Public metadata only. Never send provider URLs, tokens or account data upstream. */
export interface SegmentLookup {
  episodeId: string
  seriesTmdbId: number | null
  seriesImdbId: string | null
  seasonNumber: number
  episodeNumber: number
  absoluteEpisodeNumber?: number
  durationSeconds?: number
}

type AnimeMapping = {
  type?: string
  mal_id?: number
  themoviedb_id?: { tv?: number }
  season?: { tmdb?: number }
  episode_offset?: { tmdb?: number }
}

const MAPPINGS_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json'
const MAX_ENTRIES = 1000
const cache = new Map<string, { expires: number; result: EpisodeSegmentItem[] }>()
const pending = new Map<string, Promise<EpisodeSegmentItem[]>>()
let mappings: { expires: number; rows: AnimeMapping[] } | undefined
let mappingsRequest: Promise<AnimeMapping[]> | undefined

const upstreamRequests = new Map<string, number[]>()
async function json(url: string): Promise<unknown> {
  const host = new URL(url).host
  const now = Date.now()
  const recent = (upstreamRequests.get(host) ?? []).filter(t => t > now - 60_000)
  if (recent.length >= 100) throw new Error('Segment metadata request budget exceeded')
  recent.push(now)
  upstreamRequests.set(host, recent)
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Segment metadata HTTP ${response.status}`)
  return response.json()
}

async function animeMappings(): Promise<AnimeMapping[]> {
  if (mappings && mappings.expires > Date.now()) return mappings.rows
  if (!mappingsRequest) {
    mappingsRequest = json(MAPPINGS_URL).then((data) => {
      if (!Array.isArray(data)) throw new Error('Invalid anime mapping data')
      const rows = data.filter((row) => row && typeof row === 'object') as AnimeMapping[]
      mappings = { rows, expires: Date.now() + 24 * 3600_000 }
      return rows
    }).catch(() => { mappings = { rows: [], expires: Date.now() + 300_000 }; return [] }).finally(() => { mappingsRequest = undefined })
  }
  return mappingsRequest
}

/** No title matching: use explicit TMDB seasons/offsets or an unambiguous whole-series mapping. */
export function resolveAnimeEpisode(rows: AnimeMapping[], ref: SegmentLookup): { malId: number; episode: number } | null {
  if (!ref.seriesTmdbId || ref.seasonNumber <= 0) return null
  const matches = rows.filter((r) => r.type === 'TV' && r.themoviedb_id?.tv === ref.seriesTmdbId && Number.isSafeInteger(r.mal_id) && r.mal_id! > 0)
  const seasonal = matches.filter((r) => r.season?.tmdb === ref.seasonNumber)
  if (seasonal.length) {
    const applicable = seasonal.filter((r) => Number.isSafeInteger(r.episode_offset?.tmdb ?? 0) && (r.episode_offset?.tmdb ?? 0) >= 0 && ref.episodeNumber > (r.episode_offset?.tmdb ?? 0))
      .sort((a, b) => (b.episode_offset?.tmdb ?? 0) - (a.episode_offset?.tmdb ?? 0))
    const first = applicable[0]
    if (!first || (applicable[1] && (applicable[1].episode_offset?.tmdb ?? 0) === (first.episode_offset?.tmdb ?? 0))) return null
    return { malId: first.mal_id!, episode: ref.episodeNumber - (first.episode_offset?.tmdb ?? 0) }
  }
  if (matches.length !== 1 || matches[0].season?.tmdb != null || matches[0].episode_offset?.tmdb != null) return null
  const episode = ref.seasonNumber === 1 ? ref.episodeNumber : ref.absoluteEpisodeNumber
  return episode && Number.isSafeInteger(episode) && episode > 0 ? { malId: matches[0].mal_id!, episode } : null
}

export function validSegment(s: Pick<EpisodeSegmentItem, 'startMs' | 'endMs'>, durationSeconds?: number): boolean {
  return Number.isSafeInteger(s.startMs) && Number.isSafeInteger(s.endMs) && s.startMs >= 0 && s.endMs > s.startMs &&
    s.endMs <= 24 * 3600_000 && (durationSeconds == null || s.endMs <= durationSeconds * 1000)
}

export function mapAniSkip(data: unknown, durationSeconds?: number): EpisodeSegmentItem[] {
  const response = data as { found?: boolean; results?: Array<{ interval?: { startTime: number; endTime: number }; skipType?: string; episodeLength?: number }> } | null
  if (!response?.found || !Array.isArray(response.results)) return []
  const types: Record<string, SegmentType> = { op: 'INTRO', ed: 'CREDITS', recap: 'RECAP' }
  const result: EpisodeSegmentItem[] = []
  for (const row of response.results) {
    const type = types[row?.skipType ?? '']
    if (!type || !row.interval || typeof row.interval.startTime !== 'number' || typeof row.interval.endTime !== 'number') continue // Mixed openings/endings may contain story: never cut them.
    const segment: EpisodeSegmentItem = {
      type, startMs: Math.round(row.interval.startTime * 1000), endMs: Math.round(row.interval.endTime * 1000),
      source: 'AniSkip', sourceUrl: 'https://aniskip.com',
      autoSkipSafe: durationSeconds != null && typeof row.episodeLength === 'number' && Math.abs(row.episodeLength - durationSeconds) <= 2,
    }
    if (validSegment(segment, durationSeconds)) result.push(segment)
  }
  // Conflicting cuts of the same type must not become an automatic cut.
  return result.filter((r, i) => result.findIndex((x) => x.type === r.type && x.startMs === r.startMs && x.endMs === r.endMs) === i)
    .map((r, _, all) => ({ ...r, autoSkipSafe: r.autoSkipSafe && all.filter((x) => x.type === r.type).length === 1 }))
}

export function mapSkipDb(data: unknown, durationSeconds?: number): EpisodeSegmentItem[] {
  const response = data as { segments?: Record<string, { start_ms?: number; end_ms?: number; match?: string; confidence?: number } | null> } | null
  if (!response?.segments || typeof response.segments !== 'object') return []
  const types: Record<string, SegmentType> = { intro: 'INTRO', recap: 'RECAP', outro: 'CREDITS', preview: 'PREVIEW' }
  return Object.entries(response.segments).flatMap(([key, value]) => {
    if (!value || !types[key]) return []
    const segment: EpisodeSegmentItem = {
      type: types[key], startMs: value.start_ms!, endMs: value.end_ms!,
      source: 'SkipDB', sourceUrl: 'https://skipdb.tv',
      autoSkipSafe: durationSeconds != null && value.match === 'exact' && (value.confidence ?? 0) >= 0.8,
    }
    return validSegment(segment, durationSeconds) ? [segment] : []
  })
}

async function lookup(ref: SegmentLookup): Promise<EpisodeSegmentItem[]> {
  const tasks: Array<Promise<EpisodeSegmentItem[]>> = []
  if (ref.seriesImdbId && /^tt\d+$/.test(ref.seriesImdbId)) {
    const qs = new URLSearchParams({ imdb_id: ref.seriesImdbId, season: String(ref.seasonNumber), episode: String(ref.episodeNumber), adjust: 'none' })
    if (ref.durationSeconds) qs.set('duration', String(ref.durationSeconds))
    tasks.push(json(`https://api.skipdb.tv/api/segments?${qs}`).then((data) => mapSkipDb(data, ref.durationSeconds)))
  }
  if (ref.seriesTmdbId) {
    tasks.push((async () => {
      const match = resolveAnimeEpisode(await animeMappings(), ref)
      if (!match) return []
      const qs = new URLSearchParams({ episodeLength: String(ref.durationSeconds ?? 0) })
      for (const type of ['op', 'ed', 'recap']) qs.append('types', type)
      return mapAniSkip(await json(`https://api.aniskip.com/v2/skip-times/${match.malId}/${match.episode}?${qs}`), ref.durationSeconds)
    })())
  }
  const responses = await Promise.allSettled(tasks)
  const result = responses.flatMap((r) => r.status === 'fulfilled' ? r.value : [])
  // Prefer duration-verified cuts; preserve disagreement as manual only.
  const selected: EpisodeSegmentItem[] = []
  for (const type of ['INTRO', 'RECAP', 'OUTRO', 'CREDITS', 'PREVIEW'] as const) {
    const candidates = result.filter((s) => s.type === type).sort((a, b) => Number(b.autoSkipSafe) - Number(a.autoSkipSafe))
    if (!candidates.length) continue
    const best = candidates[0]
    const conflict = candidates.some((s) => s.autoSkipSafe && (Math.abs(s.startMs - best.startMs) > 2000 || Math.abs(s.endMs - best.endMs) > 2000))
    selected.push({ ...best, autoSkipSafe: best.autoSkipSafe && !conflict })
  }
  return selected.sort((a, b) => a.startMs - b.startMs)
}

export async function getPlaybackSegments(ref: SegmentLookup): Promise<EpisodeSegmentItem[]> {
  if (process.env.PLAYBACK_SEGMENTS_ENABLED === 'false' || ref.seasonNumber <= 0) return []
  const key = `${ref.episodeId}:${ref.durationSeconds ?? 0}`
  const existing = cache.get(key)
  if (existing && existing.expires > Date.now()) return existing.result
  const running = pending.get(key)
  if (running) return running
  if (pending.size >= 20) return [] // Never let metadata traffic starve playback.
  const promise = lookup(ref).then((result) => {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
    cache.set(key, { result, expires: Date.now() + (result.length ? 3600_000 : 300_000) })
    return result
  }).finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}
