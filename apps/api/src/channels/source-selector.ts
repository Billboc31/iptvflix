export interface ChannelSourceRecord {
  id: string
  channelId: string
  sourceId: string
  streamUrl: string
  priority: number
  status: 'AVAILABLE' | 'UNAVAILABLE'
  lastSeenAt: Date
}

export function selectPreferredSources(sources: ChannelSourceRecord[]): ChannelSourceRecord[] {
  return [...sources].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'AVAILABLE' ? -1 : 1
    if (b.priority !== a.priority) return b.priority - a.priority
    return b.lastSeenAt.getTime() - a.lastSeenAt.getTime()
  })
}
