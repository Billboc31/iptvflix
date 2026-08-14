import type { AvailabilityStatus } from '@iptvflix/api-contracts'
import { useMovies } from './useMovies.js'
import { useSeries } from './useSeries.js'

export type FeaturedMedia = {
  id: string
  mediaType: 'movie' | 'series'
  title: string
  synopsis: string | null
  backdropUrl: string | null
  posterUrl: string | null
  availabilityStatus: AvailabilityStatus
  trailerKey: string | null
}

export function useFeaturedMedia(): { media: FeaturedMedia | null; loading: boolean } {
  const { data: moviesData, loading: moviesLoading } = useMovies({ pageSize: 1, sortBy: 'popularity' })
  const { data: seriesData, loading: seriesLoading } = useSeries({ pageSize: 1, sortBy: 'popularity' })

  const loading = moviesLoading || seriesLoading
  const movie = moviesData?.items[0] ?? null
  const series = seriesData?.items[0] ?? null

  let media: FeaturedMedia | null = null

  if (movie?.backdropUrl) {
    media = {
      id: movie.id,
      mediaType: 'movie',
      title: movie.title,
      synopsis: movie.synopsis,
      backdropUrl: movie.backdropUrl,
      posterUrl: movie.posterUrl,
      availabilityStatus: movie.availabilityStatus,
      trailerKey: movie.trailerKey,
    }
  } else if (series?.backdropUrl) {
    media = {
      id: series.id,
      mediaType: 'series',
      title: series.title,
      synopsis: series.synopsis,
      backdropUrl: series.backdropUrl,
      posterUrl: series.posterUrl,
      availabilityStatus: series.availabilityStatus,
      trailerKey: null,
    }
  } else if (movie) {
    media = {
      id: movie.id,
      mediaType: 'movie',
      title: movie.title,
      synopsis: movie.synopsis,
      backdropUrl: movie.backdropUrl,
      posterUrl: movie.posterUrl,
      availabilityStatus: movie.availabilityStatus,
      trailerKey: movie.trailerKey,
    }
  } else if (series) {
    media = {
      id: series.id,
      mediaType: 'series',
      title: series.title,
      synopsis: series.synopsis,
      backdropUrl: series.backdropUrl,
      posterUrl: series.posterUrl,
      availabilityStatus: series.availabilityStatus,
      trailerKey: null,
    }
  }

  return { media, loading }
}
