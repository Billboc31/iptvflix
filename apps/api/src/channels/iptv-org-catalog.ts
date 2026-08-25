import { normalizeChannelName } from './channel-normalizer.js'

const CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json'
const LOGOS_URL = 'https://iptv-org.github.io/api/logos.json'

export type IptvOrgChannel = {
  id: string
  name: string
  alt_names: string[]
  country: string
  categories: string[]
  is_nsfw: boolean
  closed: string | null
  logoUrl?: string | null
}

export type IptvOrgIndex = {
  byId: Map<string, IptvOrgChannel>
  /** normalizedName → channels (open only) */
  byNormalizedName: Map<string, IptvOrgChannel[]>
  /** country → normalizedName → channels */
  byCountryAndName: Map<string, Map<string, IptvOrgChannel[]>>
  fetchedAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
let cached: IptvOrgIndex | null = null
let inflight: Promise<IptvOrgIndex> | null = null

function pushName(map: Map<string, IptvOrgChannel[]>, key: string, ch: IptvOrgChannel): void {
  if (!key) return
  const arr = map.get(key) ?? []
  arr.push(ch)
  map.set(key, arr)
}

function buildIndex(channels: IptvOrgChannel[], logosByChannel: Map<string, string>): IptvOrgIndex {
  const byId = new Map<string, IptvOrgChannel>()
  const byNormalizedName = new Map<string, IptvOrgChannel[]>()
  const byCountryAndName = new Map<string, Map<string, IptvOrgChannel[]>>()

  for (const raw of channels) {
    if (raw.closed) continue
    if (raw.is_nsfw) continue

    const ch: IptvOrgChannel = {
      ...raw,
      logoUrl: logosByChannel.get(raw.id) ?? null,
    }
    byId.set(ch.id, ch)

    const names = [ch.name, ...(ch.alt_names ?? [])]
    for (const name of names) {
      const norm = normalizeChannelName(name)
      pushName(byNormalizedName, norm, ch)

      const country = (ch.country || '').toUpperCase()
      if (!country) continue
      let countryMap = byCountryAndName.get(country)
      if (!countryMap) {
        countryMap = new Map()
        byCountryAndName.set(country, countryMap)
      }
      pushName(countryMap, norm, ch)
    }
  }

  return { byId, byNormalizedName, byCountryAndName, fetchedAt: Date.now() }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`iptv-org fetch failed ${res.status}: ${url}`)
  return (await res.json()) as T
}

export async function loadIptvOrgCatalog(opts?: { force?: boolean }): Promise<IptvOrgIndex> {
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }
  if (inflight) return inflight

  inflight = (async () => {
    const [channels, logos] = await Promise.all([
      fetchJson<IptvOrgChannel[]>(CHANNELS_URL),
      fetchJson<Array<{ channel: string; in_use?: boolean; url: string }>>(LOGOS_URL).catch(
        () => [] as Array<{ channel: string; in_use?: boolean; url: string }>,
      ),
    ])

    const logosByChannel = new Map<string, string>()
    for (const logo of logos) {
      if (logo.in_use === false) continue
      if (!logosByChannel.has(logo.channel) && logo.url) {
        logosByChannel.set(logo.channel, logo.url)
      }
    }

    cached = buildIndex(channels, logosByChannel)
    return cached
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Test helper — inject a prebuilt index. */
export function setIptvOrgCatalogForTests(index: IptvOrgIndex | null): void {
  cached = index
}
