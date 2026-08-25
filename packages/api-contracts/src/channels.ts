export type ChannelResponse = {
  id: string
  name: string
  logoUrl?: string | null
  categories: string[]
}

export type ChannelStreamResponse = {
  streamUrl: string
}
