export interface ExternalMovieMetadata {
  title: string
  originalTitle: string | null
  year: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  genres: string[]
  runtimeMinutes: number | null
  imdbId: string | null
  popularity: number | null
  voteAverage: number | null
}

export interface ExternalSeriesMetadata {
  title: string
  originalTitle: string | null
  firstAirYear: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  genres: string[]
  imdbId: string | null
  popularity: number | null
  voteAverage: number | null
}

export interface MetadataProvider {
  getMovieMetadata(tmdbId: number): Promise<ExternalMovieMetadata | null>
  getSeriesMetadata(tmdbId: number): Promise<ExternalSeriesMetadata | null>
}
