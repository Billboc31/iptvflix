export type WatchlistMediaType = 'MOVIE' | 'SERIES'
export type FeedbackType = 'LIKE' | 'DISLIKE' | 'NOT_INTERESTED'

export type SetFeedbackBody = {
  feedback: FeedbackType
}

export type FeedbackItem = {
  mediaType: WatchlistMediaType
  mediaId: string
  feedback: FeedbackType
  updatedAt: string
}
export type ProgressMediaType = 'MOVIE' | 'EPISODE'

export type WatchlistEntry = {
  id: string
  profileId: string
  mediaType: WatchlistMediaType
  mediaId: string
  title: string
  posterUrl: string | null
  addedAt: string
}

export type AddToWatchlistBody = {
  mediaType: WatchlistMediaType
  mediaId: string
}

export type UpsertProgressBody = {
  progressSeconds: number
  durationSeconds: number
}

export type ViewingProgressRow = {
  id: string
  profileId: string
  mediaType: ProgressMediaType
  mediaId: string
  progressSeconds: number
  durationSeconds: number
  lastWatchedAt: string
}

export type ContinueWatchingItem = ViewingProgressRow & {
  title: string
  posterUrl: string | null
  seriesId: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeTitle: string | null
}
