export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

export type EnrichmentStatus = 'matched' | 'partial' | 'unmatched'

export type MovieResponse = {
  id: string
  title: string
  year: number | null
  synopsis: string | null
  posterUrl: string | null
  backdropUrl: string | null
  runtime: number | null
  genres: string[]
  quality: string | null
  availabilityCount: number
  availabilityStatus: AvailabilityStatus
}

export type MovieDetailResponse = MovieResponse & {
  originalTitle: string | null
  imdbId: string | null
  tmdbId: number | null
  enrichmentStatus: EnrichmentStatus
}

export type SeriesResponse = {
  id: string
  title: string
  year: number | null
  synopsis: string | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  seasonCount: number
  availabilityCount: number
  availabilityStatus: AvailabilityStatus
}

export type SeasonSummary = {
  seasonNumber: number
  title: string | null
  episodeCount: number
  airYear: number | null
}

export type SeriesDetailResponse = SeriesResponse & {
  originalTitle: string | null
  imdbId: string | null
  tmdbId: number | null
  enrichmentStatus: EnrichmentStatus
  seasons: SeasonSummary[]
}

export type EpisodeResponse = {
  id: string
  episodeNumber: number
  title: string | null
  synopsis: string | null
  durationMinutes: number | null
  airDate: string | null
  availabilityCount: number
  availabilityStatus: AvailabilityStatus
}

export type GenreResponse = {
  id: string
  name: string
}

export type PaginatedList<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type MovieFilters = {
  genreId?: string
  year?: number
  quality?: string
  q?: string
  availability?: AvailabilityStatus
  sortBy?: 'title' | 'year' | 'recentAvailability'
  page?: number
  pageSize?: number
}

export type SeriesFilters = {
  genreId?: string
  year?: number
  q?: string
  availability?: AvailabilityStatus
  sortBy?: 'title' | 'year' | 'recentAvailability'
  page?: number
  pageSize?: number
}
