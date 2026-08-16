import type { AvailabilityVariantResponse } from './catalog.js'

export type DeliveryMode = 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'

export type PlaybackProbeResult = {
  videoCodec: string
  audioCodec: string
  containerFormat: string
}

export type PlaybackResolveRequest = {
  availabilityId?: string
}

export type PlaybackSessionResponse = {
  gatewayUrl: string
  deliveryMode: DeliveryMode
  probeResult: PlaybackProbeResult | null
  containerExtension: string
  availabilityId: string
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
}
