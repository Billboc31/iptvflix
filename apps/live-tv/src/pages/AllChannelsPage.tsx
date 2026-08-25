import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChannels } from '../context/ChannelsContext.js'
import ChannelRow from '../components/channel/ChannelRow.js'

export default function AllChannelsPage() {
  const { channels, isLoading, favoriteIds, toggleFavorite, recordHistory } = useChannels()
  const [searchParams, setSearchParams] = useSearchParams()
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const searchQuery = searchParams.get('q') ?? ''
  const activeCategory = searchParams.get('category') ?? ''

  function setSearch(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function setCategory(cat: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (cat) next.set('category', cat)
      else next.delete('category')
      return next
    }, { replace: true })
  }

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const ch of channels) {
      for (const cat of ch.categories) seen.add(cat)
    }
    return Array.from(seen).sort()
  }, [channels])

  const filtered = useMemo(() => {
    let result = channels
    if (favoritesOnly) result = result.filter((c) => favoriteIds.has(c.id))
    if (activeCategory) result = result.filter((c) => c.categories.includes(activeCategory))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q))
    }
    return result
  }, [channels, favoritesOnly, activeCategory, searchQuery, favoriteIds])

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Toutes les chaînes</h1>

      {/* Search and filters */}
      <div className="space-y-4 mb-6">
        <input
          type="search"
          placeholder="Rechercher une chaîne…"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f97316]/50"
          aria-label="Rechercher une chaîne"
        />

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              favoritesOnly
                ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
            aria-pressed={favoritesOnly}
          >
            ♥ Favoris
          </button>

          {activeCategory && (
            <button
              onClick={() => setCategory('')}
              className="px-3 py-1 rounded-full text-sm border border-[#f97316] bg-[#f97316]/10 text-[#f97316] transition-colors"
              aria-pressed
            >
              {activeCategory} ✕
            </button>
          )}

          {categories.map((cat) =>
            cat === activeCategory ? null : (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-3 py-1 rounded-full text-sm border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                {cat}
              </button>
            ),
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne ne correspond à votre recherche.
          </p>
        </div>
      ) : (
        <div className="space-y-2" aria-label="Liste des chaînes">
          {filtered.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              isFavorite={favoriteIds.has(channel.id)}
              onToggleFavorite={() => toggleFavorite(channel.id)}
              onRecordHistory={() => recordHistory(channel.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
