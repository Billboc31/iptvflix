import { normalizeChannelName } from './channel-normalizer.js'
import { loadIptvOrgCatalog, type IptvOrgChannel, type IptvOrgIndex } from './iptv-org-catalog.js'
import { inferChannelLanguage } from './language-infer.js'

const LANG_TO_COUNTRY: Record<string, string> = {
  fr: 'FR',
  en: 'GB',
  ar: 'SA',
  it: 'IT',
  es: 'ES',
  de: 'DE',
  nl: 'NL',
  pt: 'PT',
  tr: 'TR',
  pl: 'PL',
  ru: 'RU',
  el: 'GR',
  hi: 'IN',
  zh: 'CN',
}

const PREFIX_COUNTRY: Record<string, string> = {
  fr: 'FR',
  france: 'FR',
  be: 'BE',
  bel: 'BE',
  ch: 'CH',
  uk: 'GB',
  gb: 'GB',
  us: 'US',
  usa: 'US',
  ca: 'CA',
  de: 'DE',
  it: 'IT',
  es: 'ES',
  pt: 'PT',
  nl: 'NL',
  ar: 'SA',
  tr: 'TR',
  pl: 'PL',
  ru: 'RU',
}

function extractPrefixToken(text: string): string | null {
  const trimmed = text.trim()
  const pipe = trimmed.match(/^([A-Za-z]{2,6})\s*[|:\-–—]\s*/)
  if (pipe) return pipe[1]!.toLowerCase()
  const bracket = trimmed.match(/^\[([A-Za-z]{2,6})\]\s*/)
  if (bracket) return bracket[1]!.toLowerCase()
  return null
}

/** Infer ISO 3166-1 alpha-2 country from IPTV name / group / language. */
export function inferChannelCountry(
  providerName: string,
  groupTitle?: string | null,
  language?: string | null,
): string | null {
  for (const text of [groupTitle, providerName]) {
    if (!text) continue
    const token = extractPrefixToken(text)
    if (token && PREFIX_COUNTRY[token]) return PREFIX_COUNTRY[token]!
  }

  const lang = language ?? inferChannelLanguage(providerName, groupTitle)
  if (lang && LANG_TO_COUNTRY[lang]) return LANG_TO_COUNTRY[lang]!
  return null
}

export function languageToPreferredCountry(langs: string[] | undefined): string {
  const primary = langs?.[0]?.trim().toLowerCase().slice(0, 2)
  if (primary && LANG_TO_COUNTRY[primary]) return LANG_TO_COUNTRY[primary]!
  return 'FR'
}

function uniqueMatch(candidates: IptvOrgChannel[]): IptvOrgChannel | null {
  const ids = new Set(candidates.map((c) => c.id))
  if (ids.size !== 1) return null
  return candidates[0] ?? null
}

export function matchIptvOrgChannel(
  index: IptvOrgIndex,
  providerName: string,
  opts?: { groupTitle?: string | null; countryHint?: string | null },
): IptvOrgChannel | null {
  const norm = normalizeChannelName(providerName)
  if (!norm) return null

  const country =
    opts?.countryHint?.toUpperCase() ||
    inferChannelCountry(providerName, opts?.groupTitle) ||
    null

  if (country) {
    const inCountry = index.byCountryAndName.get(country)?.get(norm) ?? []
    const local = uniqueMatch(inCountry)
    if (local) return local
  }

  const global = uniqueMatch(index.byNormalizedName.get(norm) ?? [])
  return global
}

export async function resolveIptvOrgMatch(
  providerName: string,
  opts?: { groupTitle?: string | null; countryHint?: string | null },
): Promise<IptvOrgChannel | null> {
  try {
    const index = await loadIptvOrgCatalog()
    return matchIptvOrgChannel(index, providerName, opts)
  } catch {
    return null
  }
}
