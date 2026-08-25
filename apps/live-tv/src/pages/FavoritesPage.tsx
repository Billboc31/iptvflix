import { useChannels } from '../context/ChannelsContext.js'
import ChannelRow from '../components/channel/ChannelRow.js'

export default function FavoritesPage() {
  const { channels, isLoading, favoriteIds, toggleFavorite } = useChannels()

  const favorites = channels.filter((c) => favoriteIds.has(c.id))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Favoris</h1>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">♥</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne favorite pour l'instant. Ajoutez des chaînes en cliquant sur le cœur.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              isFavorite
              onToggleFavorite={() => toggleFavorite(channel.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
