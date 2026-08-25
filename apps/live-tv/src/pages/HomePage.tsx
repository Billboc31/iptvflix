import { useEffect, useState } from 'react'
import type { ChannelResponse } from '@iptvflix/api-contracts'
import { listChannels } from '../lib/api.js'

export default function HomePage() {
  const [channels, setChannels] = useState<ChannelResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listChannels()
      .then(setChannels)
      .catch(() => setError('Impossible de charger les chaînes.'))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm" role="alert">{error}</div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Accueil TV</h1>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne disponible pour le moment. Le catalogue Live TV sera disponible prochainement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChannelCard({ channel }: { channel: ChannelResponse }) {
  return (
    <div className="bg-[#111118] border border-white/5 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-[#f97316]/30 transition-colors cursor-pointer">
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
      <span className="text-white text-xs font-medium text-center truncate w-full">{channel.name}</span>
      {channel.category && (
        <span className="text-gray-500 text-xs truncate w-full text-center">{channel.category}</span>
      )}
    </div>
  )
}
