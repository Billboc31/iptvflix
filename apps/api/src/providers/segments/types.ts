export interface CanonicalEpisodeRef {
  episodeId: string
  seriesImdbId: string | null
  seriesTmdbId?: number | null
  seasonNumber: number
  episodeNumber: number
}

export interface RawSegment {
  type: 'RECAP' | 'INTRO' | 'OUTRO' | 'CREDITS' | 'PREVIEW'
  startMs: number
  endMs: number
  sourceProvider: string
  sourceExternalId?: string
  confidence?: number
  submissionCount?: number
  sourceUpdatedAt?: Date
}

export interface SegmentProvider {
  fetchEpisodeSegments(episode: CanonicalEpisodeRef): Promise<RawSegment[]>
}
