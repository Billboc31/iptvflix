import type { IntroDbSegmentResponse } from './types.js'
import type { RawSegment } from '../types.js'

const PROVIDER = 'introdb'

export function mapIntroDbResponse(raw: IntroDbSegmentResponse, _episodeId: string): RawSegment[] {
  const segments: RawSegment[] = []
  const sourceUpdatedAt = raw.updatedAt ? new Date(raw.updatedAt) : undefined

  if (raw.recap) {
    segments.push({
      type: 'RECAP',
      startMs: Math.round(raw.recap.start * 1000),
      endMs: Math.round(raw.recap.end * 1000),
      sourceProvider: PROVIDER,
      confidence: raw.confidence ?? undefined,
      submissionCount: raw.submissionCount ?? undefined,
      sourceUpdatedAt,
    })
  }

  if (raw.intro) {
    segments.push({
      type: 'INTRO',
      startMs: Math.round(raw.intro.start * 1000),
      endMs: Math.round(raw.intro.end * 1000),
      sourceProvider: PROVIDER,
      confidence: raw.confidence ?? undefined,
      submissionCount: raw.submissionCount ?? undefined,
      sourceUpdatedAt,
    })
  }

  if (raw.outro) {
    segments.push({
      type: 'OUTRO',
      startMs: Math.round(raw.outro.start * 1000),
      endMs: Math.round(raw.outro.end * 1000),
      sourceProvider: PROVIDER,
      confidence: raw.confidence ?? undefined,
      submissionCount: raw.submissionCount ?? undefined,
      sourceUpdatedAt,
    })
  }

  return segments
}
