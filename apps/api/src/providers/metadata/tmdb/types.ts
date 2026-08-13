export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbMovieDetail {
  id: number
  title: string
  original_title: string
  release_date: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  genres: TmdbGenre[]
  runtime: number | null
  imdb_id: string | null
  popularity: number
  vote_average: number
  status?: string
}

export interface TmdbSeriesDetail {
  id: number
  name: string
  original_name: string
  first_air_date: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  genres: TmdbGenre[]
  popularity: number
  vote_average: number
  status?: string
}

export interface TmdbSearchResultItem {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  popularity?: number
  vote_average?: number
}

export interface TmdbSearchResponse {
  results: TmdbSearchResultItem[]
}

export interface TmdbVideoResult {
  key: string
  site: string
  type: string
  official: boolean
  published_at?: string
}

export interface TmdbVideosResponse {
  results: TmdbVideoResult[]
}

export interface TmdbCastMember {
  name: string
  character: string
  order: number
  profile_path: string | null
}

export interface TmdbCrewMember {
  name: string
  job: string
  profile_path: string | null
}

export interface TmdbCreditsResponse {
  cast: TmdbCastMember[]
  crew: TmdbCrewMember[]
}

export interface TmdbAggregateCastMember {
  name: string
  roles: { character: string; episode_count: number }[]
  order: number
  profile_path: string | null
}

export interface TmdbAggregateCreditsResponse {
  cast: TmdbAggregateCastMember[]
  crew: TmdbCrewMember[]
}

export interface TmdbReleaseDateEntry {
  certification: string
  release_type: number
}

export interface TmdbReleaseDatesRegion {
  iso_3166_1: string
  release_dates: TmdbReleaseDateEntry[]
}

export interface TmdbReleaseDatesResponse {
  results: TmdbReleaseDatesRegion[]
}

export interface TmdbContentRatingEntry {
  iso_3166_1: string
  rating: string
}

export interface TmdbContentRatingsResponse {
  results: TmdbContentRatingEntry[]
}

export interface TmdbSeasonEpisode {
  episode_number: number
  name: string | null
  overview: string | null
  air_date: string | null
  runtime: number | null
  still_path: string | null
}

export interface TmdbSeasonResponse {
  episodes: TmdbSeasonEpisode[]
}
