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
}

export interface TmdbSearchResponse {
  results: TmdbSearchResultItem[]
}
