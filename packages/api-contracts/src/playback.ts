import type { AvailabilityVariantResponse } from './catalog.js'

export type PlaybackResolveRequest = {
  availabilityId?: string
}

export type PlaybackSessionResponse = {
  streamUrl: string
  availabilityId: string
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
}
