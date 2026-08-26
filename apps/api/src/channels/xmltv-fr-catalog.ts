import { normalizeChannelName } from './channel-normalizer.js'

const CHANNELS_PAGE_URL = 'https://xmltvfr.fr/channels.php?guide=france'

export type XmltvFrChannel = {
  id: string
  name: string
}

export type XmltvFrIndex = {
  byId: Map<string, XmltvFrChannel>
  /** normalizedName → channels */
  byNormalizedName: Map<string, XmltvFrChannel[]>
  fetchedAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
let cached: XmltvFrIndex | null = null
let inflight: Promise<XmltvFrIndex> | null = null

/** Parses the markdown/HTML table from xmltvfr.fr/channels.php */
export function parseXmltvFrChannelsPage(html: string): XmltvFrChannel[] {
  const rows: XmltvFrChannel[] = []
  const rowRe = /\|\s*([A-Za-z0-9]+\.[a-z]{2,3})\s*\|\s*([^|]+?)\s*\|/g
  let match: RegExpExecArray | null
  while ((match = rowRe.exec(html)) !== null) {
    const id = match[1]!.trim()
    const name = match[2]!.trim().replace(/\s+/g, ' ')
    if (!id || name === '/' || name === '---') continue
    rows.push({ id, name })
  }
  return rows
}

function buildIndex(channels: XmltvFrChannel[]): XmltvFrIndex {
  const byId = new Map<string, XmltvFrChannel>()
  const byNormalizedName = new Map<string, XmltvFrChannel[]>()

  for (const ch of channels) {
    byId.set(ch.id, ch)
    const norm = normalizeChannelName(ch.name)
    if (!norm) continue
    const arr = byNormalizedName.get(norm) ?? []
    arr.push(ch)
    byNormalizedName.set(norm, arr)

    // Also index by id without suffix for tvg-id lookups (e.g. TF1)
    const idNorm = normalizeChannelName(ch.id.replace(/\.[a-z]{2,3}$/i, ''))
    if (idNorm && idNorm !== norm) {
      const idArr = byNormalizedName.get(idNorm) ?? []
      if (!idArr.some((c) => c.id === ch.id)) {
        idArr.push(ch)
        byNormalizedName.set(idNorm, idArr)
      }
    }
  }

  return { byId, byNormalizedName, fetchedAt: Date.now() }
}

export async function loadXmltvFrCatalog(opts?: { force?: boolean }): Promise<XmltvFrIndex> {
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }
  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch(CHANNELS_PAGE_URL, {
      headers: { accept: 'text/html', 'user-agent': 'iptvflix/1.0' },
    })
    if (!res.ok) throw new Error(`xmltvfr fetch failed ${res.status}`)
    const html = await res.text()
    cached = buildIndex(parseXmltvFrChannelsPage(html))
    return cached
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function setXmltvFrCatalogForTests(index: XmltvFrIndex | null): void {
  cached = index
}
