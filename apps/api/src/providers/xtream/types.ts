export interface XtreamUserInfo {
  username: string
  status: string
  exp_date: string | null
  is_trial: string
  active_cons: string
  created_at: string
  max_connections: string
  allowed_output_formats: string[]
}

export interface XtreamCategory {
  category_id: string
  category_name: string
  parent_id: number
}

export interface XtreamVodStream {
  num: number
  name: string
  stream_id: number
  stream_icon: string
  rating: string
  added: string
  category_id: string
  container_extension: string
  tmdb: string
  director?: string
  actors?: string
  description?: string
  plot?: string
  cover?: string
  youtube_trailer?: string
  episode_run_time?: string
  direct_source?: string
}

export interface XtreamSeries {
  series_id: number
  name: string
  cover: string
  category_id: string
  rating: string
  plot?: string
  cast?: string
  director?: string
  genre?: string
  releaseDate?: string
  last_modified?: string
  rating_5based?: number
  backdrop_path?: string[]
  youtube_trailer?: string
  episode_run_time?: string
}

export interface XtreamSeriesDetail {
  name: string
  cover: string
  plot: string
  cast: string
  director: string
  genre: string
  releaseDate: string
  last_modified: string
  rating: string
  rating_5based: number
  backdrop_path: string[]
  youtube_trailer: string
  episode_run_time: string
  category_id: string
  category_name: string
  tmdb_id?: string
}

export interface XtreamEpisode {
  id: string
  episode_num: number
  title: string
  container_extension: string
  info: {
    duration_secs: number
    duration: string
    bitrate?: number
    rating?: number
    season?: number
    cover_big?: string
    movie_image?: string
    releasedate?: string
    plot?: string
    cast?: string
    director?: string
    tmdb_id?: string
  }
  added?: string
  season?: number
  direct_source?: string
}

export interface XtreamSeriesInfo {
  info: XtreamSeriesDetail
  episodes: Record<string, XtreamEpisode[]>
}

export interface XtreamCatalogSnapshot {
  sourceId: string
  fetchedAt: Date
  vodCategories: XtreamCategory[]
  vodStreams: XtreamVodStream[]
  seriesCategories: XtreamCategory[]
  series: XtreamSeries[]
  seriesInfo?: Record<number, XtreamSeriesInfo>
}
