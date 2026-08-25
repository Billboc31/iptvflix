import { useChannels } from '../context/ChannelsContext.js'
import ChannelRow from '../components/channel/ChannelRow.js'

export default function RecentPage() {
  const { channels, isLoading, history, favoriteIds, toggleFavorite } = useChannels()

  const byId = new Map(channels.map((c) => [c.id, c]))
  const recentChannels = history
    .map((h) => byId.get(h.channelId))
    .filter((c) => c !== undefined)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  if (recentChannels.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Récemment regardées</h1>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">🕐</p>
          <p className="text-gray-400 text-sm">
            Aucune chaîne regardée récemment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Récemment regardées</h1>
      <div className="space-y-2">
        {recentChannels.map((channel) => (
          <ChannelRow
            key={channel!.id}
            channel={channel!}
            isFavorite={favoriteIds.has(channel!.id)}
            onToggleFavorite={() => toggleFavorite(channel!.id)}
          />
        ))}
      </div>
    </div>
  )
}
