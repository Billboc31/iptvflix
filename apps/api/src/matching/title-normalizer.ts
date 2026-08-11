export interface NormalizeResult {
  normalizedTitle: string
  extractedYear: number | null
}

// Tags in specificity order: longer/more-specific patterns must precede their prefixes
const RELEASE_TAGS_SOURCE = [
  // Source tags
  'TSCAM', 'DVDSCR', 'DVDRip', 'BDRip', 'WEB-DL', 'WEBDL', 'WEBRip', 'HDRip', 'BluRay', 'BLU-RAY', 'HDTV', 'CAM', 'TS',
  // Quality tags
  '2160p', '1080p', '720p', '480p', '360p', 'UHD', '4K', 'SD', 'HD',
  // HDR tags (longer first)
  'HDR10', 'Dolby\\.?Vision', 'HDR', 'DV',
  // Codec tags (longer first)
  'H\\.?265', 'H\\.?264', 'x265', 'x264', 'HEVC', 'AVC', 'VP9',
  // Audio tags (longer first)
  'DTS-HD', 'DTS:X', 'DTS', 'TrueHD', 'DD5\\.?1', 'AC3', 'Atmos', 'HDMA', 'FLAC', 'AAC', 'MP3',
  // Channel tags
  '7\\.?1', '5\\.?1', '2\\.?0',
  // Language/subtitle markers (longer first)
  'TRUEFRENCH', 'VOSTFR', 'VOFF', 'VFF', 'VOST', 'MULTi', 'MULTI', 'FRENCH', 'ENG', 'VF', 'VO',
  // Post-production tags (longer first)
  "DIRECTOR(?:'?S)?", 'THEATRICAL', 'EXTENDED', 'UNRATED', 'PROPER', 'REPACK', 'RETAIL', 'REMUX', 'IMAX',
  // Episode patterns (compound before simple)
  'S\\d+E\\d+', 'EP\\d+', 'E\\d+',
].join('|')

const YEAR_RE = /\b(19\d{2}|20[012]\d)\b/

function makeTagRe(global: boolean): RegExp {
  return new RegExp(`\\b(?:${RELEASE_TAGS_SOURCE})\\b`, global ? 'gi' : 'i')
}

export function normalizeTitle(raw: string): NormalizeResult {
  // Step 1: Replace dot and underscore separators with spaces
  let working = raw.replace(/[._]/g, ' ')

  // Step 2: Extract year — heuristic: a year at position 0 with no release tags is part of the title
  const yearMatch = YEAR_RE.exec(working)
  let extractedYear: number | null = null

  if (yearMatch) {
    const isYearAtStart = working.slice(0, yearMatch.index).trim().length === 0
    const hasReleaseTags = makeTagRe(false).test(working)
    if (!isYearAtStart || hasReleaseTags) {
      extractedYear = parseInt(yearMatch[1], 10)
      working = working.slice(0, yearMatch.index) + working.slice(yearMatch.index + yearMatch[0].length)
    }
  }

  // Step 3: Remove release/encoding tags
  working = working.replace(makeTagRe(true), ' ')

  // Step 4: Remove leftover empty parenthetical groups and isolated hyphens
  working = working.replace(/\(\s*\)/g, ' ')
  working = working.replace(/\[\s*\]/g, ' ')
  working = working.replace(/\{\s*\}/g, ' ')
  // Remove hyphens that are not between word characters
  working = working.replace(/(?<!\w)-(?!\w)/g, ' ')

  // Step 5: Collapse whitespace, strip leading/trailing punctuation, lowercase
  const normalizedTitle = working
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s\[\](){}]+|[\s\[\](){}]+$/g, '')
    .trim()
    .toLocaleLowerCase('fr')

  return { normalizedTitle, extractedYear }
}
