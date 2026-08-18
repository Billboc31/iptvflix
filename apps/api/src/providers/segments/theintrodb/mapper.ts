import type { TheIntroDbResponse, TheIntroDbSegment } from './types.js'
import type { RawSegment } from '../types.js'

const PROVIDER = 'theintrodb'

const TYPE_MAP: Record<string, RawSegment['type']> = {
  intro: 'INTRO',
  recap: 'RECAP',
  credits: 'CREDITS',
  preview: 'PREVIEW',
}

function pickBestEntry(entries: TheIntroDbSegment[]): TheIntroDbSegment | null {
  const valid = entries.filter(
    (e) => typeof e.start === 'number' && typeof e.end === 'number',
  )
  if (valid.length === 0) return null
  // Highest submissions wins; tie-break: first entry
  return valid.reduce<TheIntroDbSegment>((best, curr) => {
    return (curr.submissions ?? 0) > (best.submissions ?? 0) ? curr : best
  }, valid[0])
}

export function mapTheIntroDbResponse(raw: TheIntroDbResponse, _episodeId: string): RawSegment[] {
  const segments: RawSegment[] = []

  for (const [key, entries] of Object.entries(raw)) {
    const type = TYPE_MAP[key]
    if (!type) {
      console.warn(JSON.stringify({ level: 'warn', event: 'theintrodb_unknown_segment_key', key }))
      continue
    }
    if (!Array.isArray(entries) || entries.length === 0) continue

    const best = pickBestEntry(entries)
    if (!best) continue

    segments.push({
      type,
      startMs: Math.round(best.start * 1000),
      endMs: Math.round(best.end * 1000),
      sourceProvider: PROVIDER,
      submissionCount: best.submissions ?? undefined,
      confidence: best.verified === true ? 1.0 : undefined,
    })
  }

  return segments
}
