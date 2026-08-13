import type { M3UEntry, M3UClassifiedEntry } from './types.js'
import { M3UParseError } from './errors.js'

const EXTINF_ATTR_RE = /(\S+?)="([^"]*)"/g
const SEASON_EPISODE_RE = /[Ss](\d{1,2})[Ee](\d{1,2})/

export function parseM3U(text: string): M3UEntry[] {
  const lines = text.split(/\r?\n/)

  // Find first non-empty line and validate header
  const firstNonEmpty = lines.find((l) => l.trim().length > 0)
  if (!firstNonEmpty || !firstNonEmpty.trimStart().startsWith('#EXTM3U')) {
    throw new M3UParseError('Missing or invalid #EXTM3U header')
  }

  const entries: M3UEntry[] = []
  let pendingExtinf: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('#EXTINF:')) {
      // If we had a previous #EXTINF with no URL, discard it silently
      pendingExtinf = trimmed
      continue
    }

    if (trimmed.startsWith('#')) {
      // Other directives — ignore
      continue
    }

    // URL line
    if (pendingExtinf !== null) {
      entries.push(parseExtinf(pendingExtinf, trimmed))
      pendingExtinf = null
    }
    // URL without preceding #EXTINF — skip silently
  }

  return entries
}

function parseExtinf(extinfLine: string, streamUrl: string): M3UEntry {
  // Extract attributes from the #EXTINF line
  let tvgId: string | null = null
  let tvgName: string | null = null
  let tvgLogo: string | null = null
  let groupTitle: string | null = null

  const attrSection = extinfLine.indexOf(':') !== -1 ? extinfLine.slice(extinfLine.indexOf(':') + 1) : ''

  let match: RegExpExecArray | null
  EXTINF_ATTR_RE.lastIndex = 0
  while ((match = EXTINF_ATTR_RE.exec(attrSection)) !== null) {
    const key = match[1].toLowerCase()
    const value = match[2]
    if (key === 'tvg-id') tvgId = value || null
    else if (key === 'tvg-name') tvgName = value || null
    else if (key === 'tvg-logo') tvgLogo = value || null
    else if (key === 'group-title') groupTitle = value || null
  }

  // rawTitle is the comma-trailing segment (after the last comma on the line)
  const commaIdx = extinfLine.lastIndexOf(',')
  const rawTitle = commaIdx !== -1 ? extinfLine.slice(commaIdx + 1).trim() : ''

  return { tvgId, tvgName, tvgLogo, groupTitle, rawTitle, streamUrl }
}

export function classifyEntries(entries: M3UEntry[]): M3UClassifiedEntry[] {
  return entries.map((entry) => {
    const group = (entry.groupTitle ?? '').toLowerCase()
    const title = entry.rawTitle

    const seMatch = SEASON_EPISODE_RE.exec(title)

    // Episode: group contains series/show/episode AND title matches SxxExx
    if (seMatch && (group.includes('series') || group.includes('show') || group.includes('episode'))) {
      const seasonNumber = parseInt(seMatch[1], 10)
      const episodeNumber = parseInt(seMatch[2], 10)
      // seriesKey: normalize the fragment before the SxxExx match
      const prefix = title.slice(0, seMatch.index).trim().toLowerCase()
      const seriesKey = prefix || (entry.tvgName ?? entry.streamUrl)
      return {
        ...entry,
        kind: 'episode' as const,
        seasonNumber,
        episodeNumber,
        seriesKey,
      }
    }

    // Movie: group contains movie/film/vod but NOT SxxExx in title
    if (
      !seMatch &&
      (group.includes('movie') || group.includes('film') || group.includes('vod'))
    ) {
      return {
        ...entry,
        kind: 'movie' as const,
        seasonNumber: null,
        episodeNumber: null,
        seriesKey: null,
      }
    }

    return {
      ...entry,
      kind: 'unclassified' as const,
      seasonNumber: null,
      episodeNumber: null,
      seriesKey: null,
    }
  })
}
