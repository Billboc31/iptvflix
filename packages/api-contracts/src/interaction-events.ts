export type InteractionEventType =
  // Discovery / browsing
  | 'HOME_OPENED'
  | 'SHELF_IMPRESSION'
  | 'SHELF_VIEWED'
  | 'SHELF_ITEM_IMPRESSION'
  | 'SHELF_ITEM_OPENED'
  | 'DETAIL_OPENED'
  | 'TRAILER_PREVIEW_STARTED'
  | 'TRAILER_PREVIEW_COMPLETED'
  | 'PREVIEW_STARTED'
  | 'SEARCH_PERFORMED'
  | 'SEARCH_RESULT_IMPRESSION'
  | 'SEARCH_RESULT_OPENED'
  // Intent / explicit preference
  | 'MY_LIST_ADDED'
  | 'MY_LIST_REMOVED'
  | 'LIKED'
  | 'DISLIKED'
  | 'RATED'
  | 'CONTINUE_WATCHING_DISMISSED'
  | 'REMINDER_ADDED'
  // Playback
  | 'PLAY_STARTED'
  | 'PLAY_RESUMED'
  | 'PLAY_PAUSED'
  | 'PLAY_STOPPED'
  | 'PLAY_COMPLETED'
  | 'PLAY_ABANDONED'
  | 'SEEK_FORWARD'
  | 'SEEK_BACKWARD'
  | 'SKIP_INTRO'
  | 'SKIP_RECAP'
  | 'SKIP_OUTRO'
  | 'NEXT_EPISODE_AUTO'
  | 'NEXT_EPISODE_MANUAL'
  | 'SOURCE_SELECTED'
  | 'AUDIO_TRACK_SELECTED'
  | 'SUBTITLE_TRACK_SELECTED'
  | 'PLAYBACK_SPEED_CHANGED'
  | 'WATCHED_10_PERCENT'
  | 'WATCHED_25_PERCENT'
  | 'WATCHED_50_PERCENT'
  | 'WATCHED_75_PERCENT'
  | 'WATCHED_90_PERCENT'
  // Profile / settings
  | 'PROFILE_SELECTED'
  | 'PROFILE_PREFERENCE_CHANGED'
  | 'NEVER_STOP_ENABLED'
  | 'NEVER_STOP_DISABLED'

export type InteractionEventBody = {
  eventType: string
  mediaType?: string | null
  mediaId?: string | null
  episodeId?: string | null
  occurredAt?: string | null
  positionMs?: number | null
  durationMs?: number | null
  shelfId?: string | null
  deviceType?: string | null
  sourceId?: string | null
  metadataJson?: Record<string, unknown> | null
  // T100 additions
  seriesId?: string | null
  seasonId?: string | null
  seasonNumber?: number | null
  progressPercent?: number | null
  shelfConceptId?: string | null
  shelfPosition?: number | null
  itemPositionInShelf?: number | null
  searchQueryNormalized?: string | null
  availabilityId?: string | null
  clientType?: string | null
  appVersion?: string | null
  sessionId?: string | null
  referrerSurface?: string | null
  schemaVersion?: number | null
  idempotencyKey?: string | null
}

export type InteractionEventBatch = {
  events: InteractionEventBody[]
}

export type BatchEventResponse = {
  sessionId?: string | null
}
