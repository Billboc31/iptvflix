import { useState } from 'react'
import type { ChannelResponse } from '@iptvflix/api-contracts'
import ChannelLogo from './ChannelLogo.js'
import EpgProgress from './EpgProgress.js'
import { getChannelStream, ApiError } from '../../lib/api.js'

type Props = {
  channel: ChannelResponse
  onToggleFavorite?: () => void
  isFavorite?: boolean
  onRecordHistory?: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChannelRow({ channel, onToggleFavorite, isFavorite, onRecordHistory }: Props) {
  const [isLoadingStream, setIsLoadingStream] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)

  const epgNow = channel.epg?.now
  const epgNext = channel.epg?.next

  async function handlePlay() {
    setStreamError(null)
    setIsLoadingStream(true)
    try {
      const { streamUrl } = await getChannelStream(channel.id)
      onRecordHistory?.()
      window.open(streamUrl, '_blank', 'noopener')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStreamError('Flux indisponible')
      } else {
        setStreamError('Erreur de lecture')
      }
    } finally {
      setIsLoadingStream(false)
    }
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#111118] border border-white/5 rounded-xl hover:border-[#f97316]/20 transition-colors group">
      <ChannelLogo logoUrl={channel.logoUrl} name={channel.name} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">{channel.name}</span>
          {channel.categories[0] && (
            <span className="hidden sm:block shrink-0 text-[10px] text-gray-500 border border-white/10 px-1.5 py-0.5 rounded">
              {channel.categories[0]}
            </span>
          )}
        </div>

        {epgNow && (
          <div className="mt-1 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-300 text-xs truncate">{epgNow.title}</span>
              <span className="shrink-0 text-gray-500 text-[10px]">
                {formatTime(epgNow.startTime)}–{formatTime(epgNow.endTime)}
              </span>
            </div>
            <EpgProgress startTime={epgNow.startTime} endTime={epgNow.endTime} />
          </div>
        )}

        {epgNext && (
          <p className="text-gray-500 text-[10px] mt-1 truncate">
            Ensuite : {epgNext.title}
          </p>
        )}

        {streamError && (
          <p className="text-red-400 text-xs mt-1">{streamError}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onToggleFavorite && (
          <button
            className={`p-1.5 rounded-full transition-colors ${
              isFavorite
                ? 'text-[#f97316]'
                : 'text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100'
            }`}
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={isFavorite}
          >
            ♥
          </button>
        )}

        <button
          className="px-3 py-1.5 rounded-lg bg-[#f97316]/10 text-[#f97316] text-xs font-medium hover:bg-[#f97316]/20 transition-colors disabled:opacity-50"
          onClick={handlePlay}
          disabled={isLoadingStream}
          aria-label={`Regarder ${channel.name}`}
        >
          {isLoadingStream ? (
            <span className="w-3 h-3 border border-[#f97316]/30 border-t-[#f97316] rounded-full animate-spin inline-block" />
          ) : (
            '▶'
          )}
        </button>
      </div>
    </div>
  )
}
