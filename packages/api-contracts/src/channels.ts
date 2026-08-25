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

export type ChannelFavoriteRequest = {
  channelId: string
}

export type ChannelHistoryEntry = {
  channelId: string
  name: string
  logoUrl?: string | null
  watchedAt: string
}
