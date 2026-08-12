export interface PlexLibrarySection {
  key: string
  title: string
  type: 'movie' | 'show'
}

export interface PlexGuid {
  id: string
}

export interface PlexMovieItem {
  ratingKey: string
  title: string
  year?: number
  thumb?: string
  summary?: string
  Guid?: PlexGuid[]
}

export interface PlexShowItem {
  ratingKey: string
  title: string
  year?: number
  thumb?: string
  summary?: string
  Guid?: PlexGuid[]
}

export interface PlexCatalogSnapshot {
  sourceId: string
  fetchedAt: Date
  movies: PlexMovieItem[]
  shows: PlexShowItem[]
}
