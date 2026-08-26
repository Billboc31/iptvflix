import { useNavigate } from 'react-router-dom'
import type { ChannelResponse } from '@iptvflix/api-contracts'
import ChannelLogo from './ChannelLogo.js'
import EpgProgress from './EpgProgress.js'

type Props = {
  channel: ChannelResponse
  onPlay?: (channelId: string) => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChannelCard({ channel, onPlay, onToggleFavorite, isFavorite }: Props) {
  const navigate = useNavigate()

  const epgNow = channel.epg?.now

  function handlePlay() {
    if (onPlay) {
      onPlay(channel.id)
    } else {
      navigate(`/watch/${channel.id}`)
    }
  }

  return (
    <div className="relative bg-[#111118] border border-white/5 rounded-xl overflow-hidden hover:border-[#f97316]/30 transition-colors group">
      <button
        className="w-full p-4 flex flex-col gap-3 text-left"
        onClick={handlePlay}
        aria-label={`Regarder ${channel.name}`}
      >
        <div className="flex items-center gap-3">
          <ChannelLogo logoUrl={channel.logoUrl} name={channel.name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold truncate">{channel.name}</span>
              <span className="shrink-0 text-[10px] font-bold bg-[#f97316] text-white px-1.5 py-0.5 rounded">
                LIVE
              </span>
            </div>
            {epgNow && (
              <p className="text-gray-400 text-xs truncate mt-0.5">{epgNow.title}</p>
            )}
          </div>
        </div>

        {epgNow && (
          <>
            <EpgProgress startTime={epgNow.startTime} endTime={epgNow.endTime} />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{formatTime(epgNow.startTime)}</span>
              <span>{formatTime(epgNow.endTime)}</span>
            </div>
          </>
        )}

      </button>

      {onToggleFavorite && (
        <button
          className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full ${
            isFavorite ? 'text-[#f97316]' : 'text-gray-500 hover:text-white'
          }`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={isFavorite}
        >
          ♥
        </button>
      )}
    </div>
  )
}
