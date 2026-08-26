const QUALITY_TOKEN_RE =
  /\b(?:FHD|UHD|4K|HD|SD|HEVC|H\.?265|H\.?264|AVC|RAW|VIP|720p|1080p|2160p|480p|360p)\b/gi

const QUALITY_PAREN_RE = /\(\s*(?:FHD|UHD|4K|HD|SD|HEVC|H\.?265|RAW|VIP)\s*\)/gi

/** Unicode faux-superscript / decorative quality badges used by some IPTV panels. */
const UNICODE_QUALITY_RE =
  /[\u00B9\u00B2\u00B3\u1D2C-\u1D6A\u1D43-\u1D5B\u2090-\u209C\u2070-\u207F\u2C7D◉●◆◇★☆]+/gu

const IPTV_PREFIX_TOKEN_RE =
  /^(?:4K|UHD|HD|SD|FHD|VF|VO|VOSTFR|VOST|VFF|VOFF|MULTI|MULTi|ENG|FR|EN|UK|US|TRUEFRENCH|FRENCH|CAM|TS|HDR|DV|HEVC|H265|RAW|VIP|\d{3,4}P)$/i

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
  working = working.replace(UNICODE_QUALITY_RE, ' ')
  working = working.replace(QUALITY_PAREN_RE, ' ')
  working = working.replace(QUALITY_TOKEN_RE, ' ')
  working = working.replace(/#+/g, ' ')
  working = working.replace(/\s+/g, ' ').trim().toLowerCase()
  return working
}

export function toCanonicalDisplayName(normalized: string): string {
  return normalized.replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('fr'))
}
