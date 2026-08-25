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
