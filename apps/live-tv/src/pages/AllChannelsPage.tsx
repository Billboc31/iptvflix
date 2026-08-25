import { useEffect, useState } from 'react'
import type { ChannelResponse } from '@iptvflix/api-contracts'
import { listChannels } from '../lib/api.js'

export default function AllChannelsPage() {
  const [channels, setChannels] = useState<ChannelResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    listChannels()
      .then(setChannels)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const categories = [...new Set(channels.map((c) => c.category).filter(Boolean))] as string[]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Toutes les chaînes</h1>

      {/* Category filter bar */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className="shrink-0 px-3 py-1 rounded-full text-sm text-gray-400 border border-white/10 hover:border-[#f97316]/40 hover:text-white transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne disponible. Le catalogue sera disponible prochainement.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          aria-label="Grille de chaînes"
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-[#111118] border border-white/5 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-[#f97316]/30 transition-colors cursor-pointer"
            >
              {channel.logoUrl ? (
                <img
                  src={channel.logoUrl}
                  alt={channel.name}
                  className="w-12 h-12 object-contain rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-[#1a1a24] rounded flex items-center justify-center text-[#f97316] font-bold text-lg">
                  {channel.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-white text-xs font-medium text-center truncate w-full">
                {channel.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
