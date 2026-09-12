import type { EpisodeSegmentItem, SegmentType } from '@iptvflix/api-contracts'

/** Public metadata only. Never send provider URLs, tokens or account data upstream. */
export interface SegmentLookup {
  catalog?: boolean
  mediaType?: 'movie' | 'episode'
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
let animeIndex = new Map<number, AnimeMapping[]>()
let mappingsRequest: Promise<AnimeMapping[]> | undefined

type ResponseCache = { get(url: string): Promise<unknown | undefined>; set(url: string, payload: unknown): Promise<void> }
let responseCache: ResponseCache | undefined
export function configureSegmentResponseCache(store: ResponseCache): void { responseCache = store }
let requestCount = 0
export function segmentRequestCount(): number { return requestCount }
const upstreamRequests = new Map<string, number[]>()
async function json(url: string): Promise<unknown> {
  const host = new URL(url).host
  const persistent = host === 'api.aniskip.com' || host === 'api.skipdb.tv' || url === 'https://skipdb.tv/api/dump'
  if (persistent && responseCache) {
    const cached = await responseCache.get(url).catch(() => undefined)
    if (cached !== undefined) return cached
  }
  const now = Date.now()
  const recent = (upstreamRequests.get(host) ?? []).filter(t => t > now - 60_000)
  if (recent.length >= 100) throw new Error('Segment metadata request budget exceeded')
  recent.push(now)
  upstreamRequests.set(host, recent)
  requestCount++
  const response = await fetch(url, { signal: AbortSignal.timeout(url === 'https://skipdb.tv/api/dump' ? 30000 : 5000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Segment metadata HTTP ${response.status}`)
  const payload: unknown = await response.json()
  if (persistent && responseCache) await responseCache.set(url, payload).catch(() => undefined)
  return payload
}

async function animeMappings(): Promise<AnimeMapping[]> {
  if (mappings && mappings.expires > Date.now()) return mappings.rows
  if (!mappingsRequest) {
    mappingsRequest = json(MAPPINGS_URL).then((data) => {
      if (!Array.isArray(data)) throw new Error('Invalid anime mapping data')
      const rows = data.filter((row) => row && typeof row === 'object') as AnimeMapping[]
      animeIndex = new Map()
      for (const row of rows) {
        const id = row.themoviedb_id?.tv
        if (id) { const group = animeIndex.get(id) ?? []; group.push(row); animeIndex.set(id, group) }
      }
      mappings = { rows, expires: Date.now() + 24 * 3600_000 }
      return rows
    }).catch(() => { mappings = { rows: [], expires: Date.now() + 300_000 }; return [] }).finally(() => { mappingsRequest = undefined })
  }
  return mappingsRequest
}

/** No title matching: use explicit TMDB seasons/offsets or an unambiguous whole-series mapping. */
export function resolveAnimeEpisode(rows: AnimeMapping[], ref: SegmentLookup): { malId: number; episode: number } | null {
  if (!ref.seriesTmdbId || (ref.mediaType !== 'movie' && ref.seasonNumber <= 0)) return null
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
  const matching = durationSeconds == null ? [] : response.results.filter(r => typeof r?.episodeLength === 'number' && Math.abs(r.episodeLength - durationSeconds) <= 2)
  for (const row of matching.length ? matching : response.results) {
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

type DumpRow = { imdb_id?: string; media_type?: string; season?: number; episode?: number; segment_type?: string; status?: string; start_ms: number; end_ms: number }
let dumpIndex: { expires: number; rows: Map<string, EpisodeSegmentItem[]> } | undefined
let dumpRequest: Promise<Map<string, EpisodeSegmentItem[]>> | undefined
export function indexSkipDbDump(data: unknown): Map<string, EpisodeSegmentItem[]> {
  const dump = data as { segments?: DumpRow[] }
  if (!Array.isArray(dump?.segments)) throw new Error('Invalid SkipDB dump')
  const index = new Map<string, EpisodeSegmentItem[]>()
  const types: Record<string, SegmentType> = { intro: 'INTRO', recap: 'RECAP', outro: 'CREDITS', preview: 'PREVIEW' }
  for (const r of dump.segments) {
    if (!r || r.status !== 'approved' || !r.imdb_id || !types[r.segment_type ?? '']) continue
    const segment: EpisodeSegmentItem = { type: types[r.segment_type!], startMs: r.start_ms, endMs: r.end_ms, autoSkipSafe: false, source: 'SkipDB', sourceUrl: 'https://skipdb.tv' }
    if (!validSegment(segment)) continue
    const key = r.media_type === 'movie' ? `${r.imdb_id}:movie` : `${r.imdb_id}:${r.season}:${r.episode}`
    const group = index.get(key) ?? []
    group.push(segment); index.set(key, group)
  }
  return index
}
async function skipDbCatalogSegments(ref: SegmentLookup): Promise<EpisodeSegmentItem[]> {
  if (!dumpIndex || dumpIndex.expires <= Date.now()) {
    if (!dumpRequest) dumpRequest = json('https://skipdb.tv/api/dump').then(data => {
      const rows = indexSkipDbDump(data)
      dumpIndex = { rows, expires: Date.now() + 86400_000 }
      return rows
    }).finally(() => { dumpRequest = undefined })
    await dumpRequest
  }
  const key = ref.mediaType === 'movie' ? `${ref.seriesImdbId}:movie` : `${ref.seriesImdbId}:${ref.seasonNumber}:${ref.episodeNumber}`
  return dumpIndex!.rows.get(key) ?? []
}

export async function lookupPlaybackSegments(ref: SegmentLookup): Promise<EpisodeSegmentItem[]> {
  const tasks: Array<Promise<EpisodeSegmentItem[]>> = []
  if (ref.seriesImdbId && /^tt\d+$/.test(ref.seriesImdbId)) {
    const qs = new URLSearchParams({ imdb_id: ref.seriesImdbId, adjust: 'none' })
    if (ref.mediaType !== 'movie') { qs.set('season', String(ref.seasonNumber)); qs.set('episode', String(ref.episodeNumber)) }
    if (ref.durationSeconds) qs.set('duration', String(ref.durationSeconds))
    tasks.push(ref.catalog ? skipDbCatalogSegments(ref) : json(`https://api.skipdb.tv/api/segments?${qs}`).then((data) => mapSkipDb(data, ref.durationSeconds)))
  }
  if (ref.seriesTmdbId && ref.mediaType !== 'movie') {
    tasks.push((async () => {
      await animeMappings()
      const match = resolveAnimeEpisode(animeIndex.get(ref.seriesTmdbId!) ?? [], ref)
      if (!match) return []
      const qs = new URLSearchParams({ episodeLength: '0' })
      for (const type of ['op', 'ed', 'recap']) qs.append('types', type)
      return mapAniSkip(await json(`https://api.aniskip.com/v2/skip-times/${match.malId}/${match.episode}?${qs}`), ref.durationSeconds)
    })())
  }
  const responses = await Promise.allSettled(tasks)
  if (responses.length && responses.every(r => r.status === 'rejected')) throw new Error('All segment providers failed')
  const result = responses.flatMap((r) => r.status === 'fulfilled' ? r.value : [])
  if (!result.length && responses.some(r => r.status === 'rejected')) throw new Error('Segment lookup incomplete')
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
  if (process.env.PLAYBACK_SEGMENTS_ENABLED === 'false' || (ref.mediaType !== 'movie' && ref.seasonNumber <= 0)) return []
  const key = `${ref.mediaType ?? 'episode'}:${ref.episodeId}:${ref.durationSeconds ?? 0}`
  const existing = cache.get(key)
  if (existing && existing.expires > Date.now()) return existing.result
  const running = pending.get(key)
  if (running) return running
  if (pending.size >= 20) return [] // Never let metadata traffic starve playback.
  const promise = lookupPlaybackSegments(ref).then((result) => {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
    cache.set(key, { result, expires: Date.now() + (result.length ? 3600_000 : 300_000) })
    return result
  }).catch(() => [] as EpisodeSegmentItem[]).finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}
