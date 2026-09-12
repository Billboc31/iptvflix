export type SegmentType = 'RECAP' | 'INTRO' | 'OUTRO' | 'CREDITS' | 'PREVIEW'

export interface EpisodeSegmentItem {
  type: SegmentType
  startMs: number
  endMs: number
  /** True only when timestamps match this stream duration and are unambiguous. */
  autoSkipSafe?: boolean
  source?: string
  sourceUrl?: string
}

export interface EpisodeSegmentsResponse {
  episodeId: string
  segments: EpisodeSegmentItem[]
}

/** Lightweight episode context for player navigation (series / season). */
export interface EpisodeContextResponse {
  id: string
  seriesId: string
  seasonNumber: number
  episodeNumber: number
  title: string | null
  posterUrl: string | null
}
