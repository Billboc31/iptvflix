const QUALITY_SUFFIX_RE = /\b(?:FHD|UHD|4K|HD|SD|720p|1080p|2160p|480p|360p)\b/gi

const IPTV_PREFIX_TOKEN_RE =
  /^(?:4K|UHD|HD|SD|FHD|VF|VO|VOSTFR|VOST|VFF|VOFF|MULTI|MULTi|ENG|FR|EN|UK|US|TRUEFRENCH|FRENCH|CAM|TS|HDR|DV|\d{3,4}P)$/i

function stripIptvPrefixes(input: string): string {
  let working = input
  for (let i = 0; i < 3; i++) {
    const bracket = /^(?:\[[^\]]*\])\s*[-–—|:]\s+/.exec(working)
    if (bracket) {
      working = working.slice(bracket[0].length)
      continue
    }
    const bareBracket = /^(?:\[[^\]]*\])\s+/.exec(working)
    if (bareBracket) {
      working = working.slice(bareBracket[0].length)
      continue
    }
    const coded = /^([A-Za-z0-9+]{1,12}(?:-[A-Za-z0-9+]{1,12}){0,3})\s*[-–—|:]\s+/.exec(working)
    if (!coded) break
    const parts = coded[1].split('-')
    if (!parts.every((p) => IPTV_PREFIX_TOKEN_RE.test(p))) break
    working = working.slice(coded[0].length)
  }
  return working
}

export function normalizeChannelName(raw: string): string {
  let working = raw.replace(/_/g, ' ')
  working = stripIptvPrefixes(working)
  working = working.replace(QUALITY_SUFFIX_RE, ' ')
  working = working.replace(/\s+/g, ' ').trim().toLowerCase()
  return working
}

export function toCanonicalDisplayName(normalized: string): string {
  return normalized.replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('fr'))
}
