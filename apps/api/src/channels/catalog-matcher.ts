import { normalizeChannelName } from './channel-normalizer.js'
import { loadIptvOrgCatalog, type IptvOrgChannel, type IptvOrgIndex } from './iptv-org-catalog.js'
import { loadXmltvFrCatalog, type XmltvFrChannel, type XmltvFrIndex } from './xmltv-fr-catalog.js'
import { inferChannelCountry } from './iptv-org-matcher.js'

export type CatalogMatch = {
  /** Stable catalog id used for EPG + curated lists (e.g. TF1.fr, Ligue1Plus.fr). */
  id: string
  name: string
  source: 'iptv-org' | 'xmltvfr' | 'tvg-id'
  country?: string | null
  categories?: string[]
  logoUrl?: string | null
}

function uniqueXmltvMatch(candidates: XmltvFrChannel[]): XmltvFrChannel | null {
  const ids = new Set(candidates.map((c) => c.id))
  if (ids.size !== 1) return null
  return candidates[0] ?? null
}

function fromIptvOrg(org: IptvOrgChannel): CatalogMatch {
  return {
    id: org.id,
    name: org.name,
    source: 'iptv-org',
    country: org.country || null,
    categories: org.categories,
    logoUrl: org.logoUrl ?? null,
  }
}

function fromXmltvFr(ch: XmltvFrChannel, countryHint?: string | null): CatalogMatch {
  const suffix = ch.id.split('.').pop()?.toUpperCase()
  const country =
    countryHint?.toUpperCase() ||
    (suffix && suffix.length === 2 ? suffix : null) ||
    'FR'
  return {
    id: ch.id,
    name: ch.name,
    source: 'xmltvfr',
    country,
    categories: [],
    logoUrl: null,
  }
}

export function matchCatalogChannel(
  iptvOrgIndex: IptvOrgIndex | null,
  xmltvIndex: XmltvFrIndex | null,
  providerName: string,
  opts?: { groupTitle?: string | null; countryHint?: string | null; tvgId?: string | null },
): CatalogMatch | null {
  const country =
    opts?.countryHint?.toUpperCase() ||
    inferChannelCountry(providerName, opts?.groupTitle) ||
    null

  const tvgId = opts?.tvgId?.trim()
  if (tvgId) {
    const orgById = iptvOrgIndex?.byId.get(tvgId)
    if (orgById) return fromIptvOrg(orgById)
    const xmlById = xmltvIndex?.byId.get(tvgId)
    if (xmlById) return { ...fromXmltvFr(xmlById, country), source: 'tvg-id' }
  }

  const norm = normalizeChannelName(providerName)
  if (!norm) return null

  if (iptvOrgIndex) {
    if (country) {
      const inCountry = iptvOrgIndex.byCountryAndName.get(country)?.get(norm) ?? []
      if (inCountry.length === 1) return fromIptvOrg(inCountry[0]!)
    }
    const global = iptvOrgIndex.byNormalizedName.get(norm) ?? []
    if (global.length === 1) return fromIptvOrg(global[0]!)
  }

  if (xmltvIndex) {
    const alias = matchFrSportAlias(xmltvIndex, norm)
    if (alias) return fromXmltvFr(alias, country ?? 'FR')

    if (country) {
      const frCandidates = (xmltvIndex.byNormalizedName.get(norm) ?? []).filter((c) =>
        c.id.endsWith('.fr'),
      )
      const local = uniqueXmltvMatch(frCandidates.length > 0 ? frCandidates : [])
      if (local) return fromXmltvFr(local, country)
    }
    const global = uniqueXmltvMatch(xmltvIndex.byNormalizedName.get(norm) ?? [])
    if (global) return fromXmltvFr(global, country)
  }

  return null
}

function matchFrSportAlias(
  xmltvIndex: XmltvFrIndex,
  norm: string,
): XmltvFrChannel | null {
  const compact = norm.replace(/\s+/g, '')

  if (/^canal\+?\s*ligue\s*1/.test(norm) || /^canal\+?ligue1/.test(compact)) {
    return xmltvIndex.byId.get('CanalPlusLigue1.fr') ?? null
  }

  const ligue = norm.match(/^ligue\s*1\+?\s*(\d{1,2})?$/) || compact.match(/^ligue1\+?(\d{1,2})?$/)
  if (ligue) {
    const n = ligue[1] ? Number(ligue[1]) : null
    let id = 'Ligue1Plus.fr'
    if (n && n >= 2 && n <= 10) id = `Ligue1Plus${n}.fr`
    return xmltvIndex.byId.get(id) ?? null
  }

  if (/^dazn(?:\s*1)?$/.test(norm) || compact === 'dazn1' || compact === 'dazn') {
    return xmltvIndex.byId.get('DAZN.fr') ?? null
  }

  return null
}

export async function resolveCatalogMatch(
  providerName: string,
  opts?: { groupTitle?: string | null; countryHint?: string | null; tvgId?: string | null },
): Promise<CatalogMatch | null> {
  try {
    const [iptvOrgIndex, xmltvIndex] = await Promise.all([
      loadIptvOrgCatalog().catch(() => null),
      loadXmltvFrCatalog().catch(() => null),
    ])
    return matchCatalogChannel(iptvOrgIndex, xmltvIndex, providerName, opts)
  } catch {
    return null
  }
}
