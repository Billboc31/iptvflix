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
  releaseStatus?: string | null
  releaseDate?: string | null
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
  releaseStatus?: string | null
  firstAirDate?: string | null
}

export type DiscoveryFeed = 'popular' | 'trending' | 'upcoming'

export interface MetadataCandidate {
  externalId: string
  title: string
  year: number | null
  mediaType: 'MOVIE' | 'SERIES'
  posterPath?: string | null
  synopsis?: string | null
  releaseStatus?: string | null
  releaseDate?: string | null
  firstAirDate?: string | null
  popularity?: number | null
  voteAverage?: number | null
}

export interface MetadataProvider {
  getMovieMetadata(tmdbId: number): Promise<ExternalMovieMetadata | null>
  getSeriesMetadata(tmdbId: number): Promise<ExternalSeriesMetadata | null>
  searchMovies(query: string, year?: number | null): Promise<MetadataCandidate[]>
  searchSeries(query: string, year?: number | null): Promise<MetadataCandidate[]>
  fetchMovieFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>
  fetchSeriesFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>
}

export class NoopMetadataProvider implements MetadataProvider {
  async getMovieMetadata(_tmdbId: number): Promise<ExternalMovieMetadata | null> {
    return null
  }

  async getSeriesMetadata(_tmdbId: number): Promise<ExternalSeriesMetadata | null> {
    return null
  }

  async searchMovies(_query: string, _year?: number | null): Promise<MetadataCandidate[]> {
    return []
  }

  async searchSeries(_query: string, _year?: number | null): Promise<MetadataCandidate[]> {
    return []
  }

  async fetchMovieFeed(_feed: DiscoveryFeed, _page: number): Promise<MetadataCandidate[]> {
    return []
  }

  async fetchSeriesFeed(_feed: DiscoveryFeed, _page: number): Promise<MetadataCandidate[]> {
    return []
  }
}
