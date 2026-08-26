import { gunzipSync } from 'node:zlib'
import type { EpgProgram } from '@iptvflix/api-contracts'

const EPG_URL = 'https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

type ParsedProgram = EpgProgram & { channelId: string }

type EpgCache = {
  byChannel: Map<string, ParsedProgram[]>
  fetchedAt: number
}

let cached: EpgCache | null = null
let inflight: Promise<EpgCache | null> | null = null

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

/** Parses XMLTV datetime "20250825210000 +0200" → ISO string. */
export function parseXmltvDateTime(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?$/)
  if (!match) return new Date(trimmed).toISOString()

  const [, y, mo, d, h, mi, s, tz] = match
  if (tz) {
    const sign = tz[0] === '+' ? 1 : -1
    const tzH = Number(tz.slice(1, 3))
    const tzM = Number(tz.slice(3, 5))
    const offsetMin = sign * (tzH * 60 + tzM)
    const utcMs = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    ) - offsetMin * 60_000
    return new Date(utcMs).toISOString()
  }
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString()
}

export function parseXmltvPrograms(xml: string): Map<string, ParsedProgram[]> {
  const byChannel = new Map<string, ParsedProgram[]>()
  const re =
    /<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]+)"[^>]*>[\s\S]*?<title(?:\s[^>]*)?>([^<]*)<\/title>/g

  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    const [, startRaw, stopRaw, channelId, titleRaw] = match
    const title = decodeXmlEntities(titleRaw!.trim())
    if (!title) continue

    const program: ParsedProgram = {
      channelId: channelId!,
      title,
      startTime: parseXmltvDateTime(startRaw!),
      endTime: parseXmltvDateTime(stopRaw!),
    }

    const arr = byChannel.get(channelId!) ?? []
    arr.push(program)
    byChannel.set(channelId!, arr)
  }

  for (const [, programs] of byChannel) {
    programs.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return byChannel
}

async function fetchEpgCache(): Promise<EpgCache | null> {
  try {
    const res = await fetch(EPG_URL, {
      headers: { accept: 'application/gzip', 'user-agent': 'iptvflix/1.0' },
    })
    if (!res.ok) {
      console.warn(`[epg] fetch failed ${res.status}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const xml = gunzipSync(buf).toString('utf8')
    const byChannel = parseXmltvPrograms(xml)
    console.info(`[epg] loaded ${byChannel.size} channels from xmltvfr`)
    return { byChannel, fetchedAt: Date.now() }
  } catch (err) {
    console.warn('[epg] load failed', err instanceof Error ? err.message : err)
    return null
  }
}

export async function ensureEpgLoaded(opts?: { force?: boolean }): Promise<EpgCache | null> {
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }
  if (inflight) return inflight

  inflight = fetchEpgCache().then((next) => {
    if (next) cached = next
    return next
  })

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function getEpgNowNext(
  catalogId: string,
  cache: EpgCache | null,
  now = new Date(),
): { now?: EpgProgram; next?: EpgProgram } {
  if (!cache) return {}
  const programs = cache.byChannel.get(catalogId)
  if (!programs?.length) return {}

  const ts = now.getTime()
  let nowProg: ParsedProgram | undefined
  let nextProg: ParsedProgram | undefined

  for (const p of programs) {
    const start = new Date(p.startTime).getTime()
    const end = new Date(p.endTime).getTime()
    if (start <= ts && end > ts) {
      nowProg = p
      continue
    }
    if (start > ts && !nextProg) {
      nextProg = p
      break
    }
  }

  const strip = (p: ParsedProgram): EpgProgram => ({
    title: p.title,
    startTime: p.startTime,
    endTime: p.endTime,
  })

  return {
    now: nowProg ? strip(nowProg) : undefined,
    next: nextProg ? strip(nextProg) : undefined,
  }
}

export function getEpgProgramsInWindow(
  catalogId: string,
  cache: EpgCache | null,
  hours = 6,
  now = new Date(),
): EpgProgram[] {
  if (!cache) return []
  const programs = cache.byChannel.get(catalogId)
  if (!programs?.length) return []

  const startTs = now.getTime()
  const endTs = startTs + hours * 60 * 60 * 1000

  return programs
    .filter((p) => {
      const start = new Date(p.startTime).getTime()
      const end = new Date(p.endTime).getTime()
      return end > startTs && start < endTs
    })
    .map(({ title, startTime, endTime }) => ({ title, startTime, endTime }))
}

export function setEpgCacheForTests(cache: EpgCache | null): void {
  cached = cache
}
