export type ReleaseEventType =
  | 'ANNOUNCED'
  | 'THEATRICAL_RELEASE'
  | 'DIGITAL_RELEASE'
  | 'SOURCE_APPEARED'
  | 'SOURCE_DISAPPEARED'

export type ReleaseEvent = {
  eventType: ReleaseEventType
  occurredAt: string
  sourceId: string | null
}

export type ReleaseLifecycle = {
  announcedAt: string | null
  theatricalReleaseDate: string | null
  digitalReleaseDate: string | null
  timeline: ReleaseEvent[]
}

export type FollowReleaseEntry = {
  id: string
  profileId: string
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  followedAt: string
}

export type FollowReleaseRequest = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
}
