import type { AvailabilityVariantResponse } from './catalog.js'

export type PlaybackResolveRequest = {
  availabilityId?: string
}

export type PlaybackSessionResponse = {
  gatewayUrl: string
  compatGatewayUrl: string
  containerExtension: string
  availabilityId: string
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
}
