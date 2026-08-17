import type { AvailabilityVariantResponse } from './catalog.js'

export type DeliveryMode = 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'

export type PlaybackErrorCategory =
  | 'SOURCE_UNREACHABLE'
  | 'SOURCE_AUTH_REJECTED'
  | 'STREAM_URL_INVALID'
  | 'PROBE_FAILED'
  | 'TRANSCODER_UNAVAILABLE'
  | 'TRANSCODING_FAILED'
  | 'MANIFEST_GENERATION_FAILED'
  | 'SEGMENT_UNAVAILABLE'
  | 'CODEC_REJECTED_BY_BROWSER'
  | 'SESSION_EXPIRED'

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
  correlationId: string
}
