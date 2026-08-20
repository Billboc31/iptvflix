export interface ExternalMovieMetadata {
  title: string
  originalTitle: string | null
  year: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  genres: string[]
  genreObjects?: Array<{ name: string; tmdbId: number }>
  runtimeMinutes: number | null
  imdbId: string | null
  popularity: number | null
  voteAverage: number | null
  voteCount?: number | null
  certification: string | null
  releaseStatus?: string | null
  status?: string | null
  releaseDate?: string | null
  originalLanguage?: string | null
  spokenLanguages?: Array<{ iso639_1: string; name: string }> | null
  productionCountries?: Array<{ iso3166_1: string; name: string }> | null
  tagline?: string | null
  keywords?: string[] | null
  belongsToCollection?: {
    tmdbId: number
    name: string
    posterPath: string | null
    backdropPath: string | null
  } | null
  externalIds?: Record<string, string | number | null> | null
}

export interface ExternalSeriesMetadata {
  title: string
  originalTitle: string | null
  firstAirYear: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  genres: string[]
  genreObjects?: Array<{ name: string; tmdbId: number }>
  imdbId: string | null
  popularity: number | null
  voteAverage: number | null
  voteCount?: number | null
  certification: string | null
  status: string | null
  releaseStatus?: string | null
  firstAirDate?: string | null
  originalLanguage?: string | null
  spokenLanguages?: Array<{ iso639_1: string; name: string }> | null
  productionCountries?: Array<{ iso3166_1: string; name: string }> | null
  tagline?: string | null
  inProduction?: boolean | null
  networks?: Array<{ id: number; name: string; logoPath: string | null; originCountry: string }> | null
  createdBy?: Array<{ id: number; name: string; profilePath: string | null }> | null
  numberOfSeasons?: number | null
  numberOfEpisodes?: number | null
  keywords?: string[] | null
  externalIds?: Record<string, string | number | null> | null
  seasons?: Array<{
    tmdbId: number
    seasonNumber: number
    name: string | null
    airDate: string | null
    posterPath: string | null
    episodeCount: number
  }> | null
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
  role: 'cast' | 'director' | 'creator'
  order: number
  profilePath: string | null
  tmdbPersonId?: number | null
  department?: string | null
  job?: string | null
}

export interface ExternalSeasonEpisode {
  episodeNumber: number
  title: string | null
  synopsis: string | null
  airDate: string | null
  runtimeMinutes: number | null
  stillPath: string | null
  tmdbId?: number | null
  voteAverage?: number | null
  voteCount?: number | null
}

export class MetadataMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetadataMappingError'
  }
}

export type DiscoveryFeed = 'popular' | 'trending' | 'upcoming' | 'now_playing' | 'airing_today'

export type DiscoverParams = { genreId?: number; language?: string }

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
  voteCount?: number | null
}

export interface MetadataProvider {
  getMovieMetadata(tmdbId: number, opts?: { language?: string }): Promise<ExternalMovieMetadata | null>
  getSeriesMetadata(tmdbId: number, opts?: { language?: string }): Promise<ExternalSeriesMetadata | null>
  searchMovies(query: string, year?: number | null): Promise<MetadataCandidate[]>
  searchSeries(query: string, year?: number | null): Promise<MetadataCandidate[]>
  fetchMovieFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>
  fetchSeriesFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]>
  fetchMovieTopRated(page: number): Promise<MetadataCandidate[]>
  fetchSeriesTopRated(page: number): Promise<MetadataCandidate[]>
  fetchMovieDiscover(params: DiscoverParams, page: number): Promise<MetadataCandidate[]>
  fetchSeriesDiscover(params: DiscoverParams, page: number): Promise<MetadataCandidate[]>
  getMovieVideos(tmdbId: number): Promise<ExternalVideo[]>
  getSeriesVideos(tmdbId: number): Promise<ExternalVideo[]>
  getMovieCredits(tmdbId: number): Promise<ExternalCreditPerson[]>
  getSeriesCredits(tmdbId: number): Promise<ExternalCreditPerson[]>
  getMovieCertification(tmdbId: number): Promise<string | null>
  getSeriesCertification(tmdbId: number): Promise<string | null>
  getSeasonEpisodes?(tmdbSeriesId: number, seasonNumber: number): Promise<ExternalSeasonEpisode[]>
}

export class NoopMetadataProvider implements MetadataProvider {
  async getMovieMetadata(_tmdbId: number, _opts?: { language?: string }): Promise<ExternalMovieMetadata | null> {
    return null
  }

  async getSeriesMetadata(_tmdbId: number, _opts?: { language?: string }): Promise<ExternalSeriesMetadata | null> {
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

  async fetchMovieTopRated(_page: number): Promise<MetadataCandidate[]> {
    return []
  }

  async fetchSeriesTopRated(_page: number): Promise<MetadataCandidate[]> {
    return []
  }

  async fetchMovieDiscover(_params: DiscoverParams, _page: number): Promise<MetadataCandidate[]> {
    return []
  }

  async fetchSeriesDiscover(_params: DiscoverParams, _page: number): Promise<MetadataCandidate[]> {
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
