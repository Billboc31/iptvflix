import { useState } from 'react'
import { useChannels } from '../context/ChannelsContext.js'
import ChannelCard from '../components/channel/ChannelCard.js'

export default function SearchPage() {
  const { channels, favoriteIds, toggleFavorite, recordHistory } = useChannels()
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const filtered = trimmed
    ? channels.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : []

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Recherche</h1>

      <input
        type="search"
        placeholder="Rechercher une chaîne…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f97316]/50 mb-6"
        aria-label="Rechercher une chaîne"
      />

      {trimmed && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-gray-400 text-sm">Aucune chaîne ne correspond à « {query} »</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              isFavorite={favoriteIds.has(channel.id)}
              onToggleFavorite={() => toggleFavorite(channel.id)}
              onPlay={recordHistory}
            />
          ))}
        </div>
      )}

      {!trimmed && (
        <p className="text-gray-500 text-sm">Saisissez un nom de chaîne pour lancer la recherche.</p>
      )}
    </div>
  )
}
