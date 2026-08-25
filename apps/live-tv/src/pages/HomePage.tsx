import type { ChannelResponse } from '@iptvflix/api-contracts'
import { useChannels } from '../context/ChannelsContext.js'
import LiveRail from '../components/channel/LiveRail.js'
import CategoryShortcuts from '../components/channel/CategoryShortcuts.js'

function historyChannels(
  channels: ChannelResponse[],
  history: { channelId: string }[],
): ChannelResponse[] {
  const byId = new Map(channels.map((c) => [c.id, c]))
  return history
    .map((h) => byId.get(h.channelId))
    .filter((c): c is ChannelResponse => c !== undefined)
}

export default function HomePage() {
  const { channels, isLoading, error, favoriteIds, toggleFavorite, history } = useChannels()

  const recentChannels = historyChannels(channels, history)

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm" role="alert">{error}</div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-10">
      <LiveRail
        title="En direct maintenant"
        channels={channels}
        isLoading={isLoading}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
      />

      {!isLoading && channels.length > 0 && (
        <CategoryShortcuts channels={channels} />
      )}

      {recentChannels.length > 0 && (
        <LiveRail
          title="Récemment regardées"
          channels={recentChannels}
          isLoading={false}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {!isLoading && channels.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne disponible pour le moment.
          </p>
        </div>
      )}
    </div>
  )
}
