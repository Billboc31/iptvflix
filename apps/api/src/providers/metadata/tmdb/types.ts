export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbCollection {
  id: number
  name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
}

export interface TmdbExternalIds {
  imdb_id?: string | null
  tvdb_id?: number | null
  wikidata_id?: string | null
  facebook_id?: string | null
  twitter_id?: string | null
  instagram_id?: string | null
}

export interface TmdbKeyword {
  id: number
  name: string
}

export interface TmdbSpokenLanguage {
  iso_639_1: string
  name: string
}

export interface TmdbProductionCountry {
  iso_3166_1: string
  name: string
}

export interface TmdbNetwork {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TmdbCreatedBy {
  id: number
  name: string
  profile_path: string | null
}

export interface TmdbSeason {
  id: number
  season_number: number
  name: string | null
  poster_path: string | null
  episode_count: number
  air_date: string | null
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
  vote_count?: number
  status?: string
  original_language?: string
  spoken_languages?: TmdbSpokenLanguage[]
  production_countries?: TmdbProductionCountry[]
  tagline?: string | null
  belongs_to_collection?: TmdbCollection | null
  keywords?: { results: TmdbKeyword[] }
  external_ids?: TmdbExternalIds
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
  vote_count?: number
  status?: string
  original_language?: string
  spoken_languages?: TmdbSpokenLanguage[]
  production_countries?: TmdbProductionCountry[]
  tagline?: string | null
  in_production?: boolean
  networks?: TmdbNetwork[]
  created_by?: TmdbCreatedBy[]
  number_of_seasons?: number
  number_of_episodes?: number
  seasons?: TmdbSeason[]
  keywords?: { results: TmdbKeyword[] }
  external_ids?: TmdbExternalIds
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
  vote_count?: number
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
  id?: number
  episode_number: number
  name: string | null
  overview: string | null
  air_date: string | null
  runtime: number | null
  still_path: string | null
  vote_average?: number
  vote_count?: number
}

export interface TmdbSeasonResponse {
  episodes: TmdbSeasonEpisode[]
}
