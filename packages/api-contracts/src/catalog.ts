export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

export type EnrichmentStatus = 'matched' | 'partial' | 'unmatched'

export type AvailabilityVariantResponse = {
  id: string
  status: AvailabilityStatus
  providerId: string
  audioLanguage: string | null
  subtitleLanguage: string | null
  videoQuality: string | null
  rawTitle: string | null
}

export type CastMemberResponse = {
  name: string
  character: string | null
  profileUrl: string | null
}

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
  trailerKey: string | null
}

export type MovieDetailResponse = MovieResponse & {
  originalTitle: string | null
  imdbId: string | null
  tmdbId: number | null
  enrichmentStatus: EnrichmentStatus
  selectedVariantId: string | null
  variants: AvailabilityVariantResponse[]
  cast: CastMemberResponse[]
  director: string | null
  voteAverage: number | null
  certification: string | null
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
  availableEpisodeCount: number
  airYear: number | null
}

export type SeriesDetailResponse = SeriesResponse & {
  originalTitle: string | null
  imdbId: string | null
  tmdbId: number | null
  enrichmentStatus: EnrichmentStatus
  selectedVariantId: string | null
  seasons: SeasonSummary[]
  variants: AvailabilityVariantResponse[]
  trailerKey: string | null
  cast: CastMemberResponse[]
  director: string | null
  voteAverage: number | null
  certification: string | null
  status: string | null
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
  selectedVariantId: string | null
  variants: AvailabilityVariantResponse[]
  watchState: 'unwatched' | 'in_progress' | 'watched' | null
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

export type ExternalMovieCandidate = {
  tmdbId: string
  title: string
  year: number | null
  synopsis: string | null
  posterUrl: string | null
  releaseStatus: string | null
  releaseDate: string | null
}

export type ExternalSeriesCandidate = {
  tmdbId: string
  title: string
  year: number | null
  synopsis: string | null
  posterUrl: string | null
  releaseStatus: string | null
  firstAirDate: string | null
}

export type SearchResponse = {
  movies: MovieResponse[]
  series: SeriesResponse[]
  externalMovies: ExternalMovieCandidate[]
  externalSeries: ExternalSeriesCandidate[]
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
