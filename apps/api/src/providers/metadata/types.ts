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
  certification: string | null
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
  certification: string | null
  status: string | null
  releaseStatus?: string | null
  firstAirDate?: string | null
}

export interface ExternalVideo {
  key: string
  site: string
  type: string
  official: boolean
  publishedAt: string | null
}

export interface ExternalCreditPerson {
  name: string
  character: string | null
  role: 'cast' | 'director'
  order: number
  profilePath: string | null
}

export interface ExternalSeasonEpisode {
  episodeNumber: number
  title: string | null
  synopsis: string | null
  airDate: string | null
  runtimeMinutes: number | null
  stillPath: string | null
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
  getMovieVideos(tmdbId: number): Promise<ExternalVideo[]>
  getSeriesVideos(tmdbId: number): Promise<ExternalVideo[]>
  getMovieCredits(tmdbId: number): Promise<ExternalCreditPerson[]>
  getSeriesCredits(tmdbId: number): Promise<ExternalCreditPerson[]>
  getMovieCertification(tmdbId: number): Promise<string | null>
  getSeriesCertification(tmdbId: number): Promise<string | null>
  getSeasonEpisodes?(tmdbSeriesId: number, seasonNumber: number): Promise<ExternalSeasonEpisode[]>
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

  async getMovieVideos(_tmdbId: number): Promise<ExternalVideo[]> {
    return []
  }

  async getSeriesVideos(_tmdbId: number): Promise<ExternalVideo[]> {
    return []
  }

  async getMovieCredits(_tmdbId: number): Promise<ExternalCreditPerson[]> {
    return []
  }

  async getSeriesCredits(_tmdbId: number): Promise<ExternalCreditPerson[]> {
    return []
  }

  async getMovieCertification(_tmdbId: number): Promise<string | null> {
    return null
  }

  async getSeriesCertification(_tmdbId: number): Promise<string | null> {
    return null
  }

  async getSeasonEpisodes(_tmdbSeriesId: number, _seasonNumber: number): Promise<ExternalSeasonEpisode[]> {
    return []
  }
}
