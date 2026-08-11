export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

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
  availabilityStatus: AvailabilityStatus
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
