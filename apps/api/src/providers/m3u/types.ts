export interface M3UEntry {
  tvgId: string | null
  tvgName: string | null
  tvgLogo: string | null
  groupTitle: string | null
  rawTitle: string
  streamUrl: string
}

export interface M3UClassifiedEntry extends M3UEntry {
  kind: 'movie' | 'episode' | 'live' | 'unclassified'
  seasonNumber: number | null
  episodeNumber: number | null
  seriesKey: string | null
}

export interface M3UCatalogSnapshot {
  sourceId: string
  fetchedAt: Date
  movies: M3UClassifiedEntry[]
  episodes: M3UClassifiedEntry[]
  liveChannels: M3UClassifiedEntry[]
  unclassified: M3UClassifiedEntry[]
}
