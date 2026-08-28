export type EpgProgram = {
  title: string
  startTime: string
  endTime: string
}

export type ChannelResponse = {
  id: string
  name: string
  logoUrl?: string | null
  categories: string[]
  /** ISO-ish 2-letter language code inferred from IPTV metadata (e.g. "fr"). */
  language?: string | null
  /** ISO 3166-1 alpha-2 country (e.g. "FR"), from iptv-org or heuristics. */
  country?: string | null
  /** Stable iptv-org id when matched (e.g. "TF1.fr"). */
  iptvOrgId?: string | null
  epg?: {
    now?: EpgProgram
    next?: EpgProgram
  }
  isFavorite?: boolean
}

export type ChannelStreamResponse = {
  streamUrl: string
}

import type { AvailabilityVariantResponse } from './catalog.js'

export type ChannelPlaybackResolveRequest = {
  /** Pick a specific channel_sources row (same id as availabilityId in the response). */
  availabilityId?: string
  clientType?: 'web' | 'android-tv'
}

export type ChannelPlaybackResponse = {
  gatewayUrl: string
  deliveryMode: 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'
  containerExtension: string
  correlationId: string
  /** Selected channel_sources.id used for this session. */
  availabilityId: string
  /** All playable sources for this channel (includes the selected one). */
  alternatives: AvailabilityVariantResponse[]
}

export type GuideChannelResponse = ChannelResponse & {
  programs: EpgProgram[]
}

export type ChannelFavoriteRequest = {
  channelId: string
}

export type LiveNowResult = {
  channelId: string
  channelName: string
  logoUrl?: string | null
  programTitle: string
  startTime: string
  endTime: string
  progress: number
  streamUrl: string
  deliveryMode: 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'
}

export type UpcomingResult = {
  channelId: string
  channelName: string
  logoUrl?: string | null
  programTitle: string
  startTime: string
  endTime: string
}

export type ChannelResult = {
  channelId: string
  channelName: string
  logoUrl?: string | null
  categories: string[]
  language?: string | null
  country?: string | null
}

export type LiveSearchResponse = {
  liveNow: LiveNowResult[]
  upcoming: UpcomingResult[]
  channels: ChannelResult[]
}

export type ChannelHistoryEntry = {
  channelId: string
  name: string
  logoUrl?: string | null
  watchedAt: string
}
