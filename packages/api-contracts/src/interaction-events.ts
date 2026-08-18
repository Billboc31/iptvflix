export type InteractionEventType =
  | 'DETAIL_OPENED'
  | 'PLAY_STARTED'
  | 'PLAY_RESUMED'
  | 'PLAY_PAUSED'
  | 'PLAY_COMPLETED'
  | 'PLAY_ABANDONED'
  | 'MY_LIST_ADDED'
  | 'MY_LIST_REMOVED'
  | 'LIKED'
  | 'DISLIKED'
  | 'SEARCH_PERFORMED'
  | 'SEARCH_RESULT_OPENED'
  | 'SHELF_IMPRESSION'
  | 'SHELF_ITEM_OPENED'
  | 'PREVIEW_STARTED'
  | 'SOURCE_SELECTED'

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
}
