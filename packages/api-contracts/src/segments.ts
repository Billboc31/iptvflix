export type SegmentType = 'RECAP' | 'INTRO' | 'OUTRO' | 'CREDITS' | 'PREVIEW'

export interface EpisodeSegmentItem {
  type: SegmentType
  startMs: number
  endMs: number
}

export interface EpisodeSegmentsResponse {
  episodeId: string
  segments: EpisodeSegmentItem[]
}
