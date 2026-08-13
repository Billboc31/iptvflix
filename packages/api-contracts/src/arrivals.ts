export type ArrivalItem = {
  id: string
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  mediaTitle: string
  sourceName: string | null
  arrivedAt: string
  readAt: string | null
}
