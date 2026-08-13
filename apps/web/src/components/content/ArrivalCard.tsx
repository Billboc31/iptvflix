import { useNavigate } from 'react-router-dom'
import { markArrivalRead } from '../../lib/api.js'
import type { ArrivalItem } from '@iptvflix/api-contracts'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

type ArrivalCardProps = {
  arrival: ArrivalItem
  onDismiss?: (id: string) => void
}

export default function ArrivalCard({ arrival, onDismiss }: ArrivalCardProps) {
  const navigate = useNavigate()
  const path = arrival.mediaType === 'MOVIE' ? `/movies/${arrival.mediaId}` : `/series/${arrival.mediaId}`

  async function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation()
    await markArrivalRead(arrival.id).catch(() => {})
    onDismiss?.(arrival.id)
  }

  return (
    <div
      onClick={() => navigate(path)}
      className="relative flex-shrink-0 w-44 cursor-pointer group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(path)}
    >
      {/* Poster placeholder */}
      <div className="aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative flex flex-col items-center justify-center gap-1 text-gray-500">
        <span className="text-3xl select-none">{arrival.mediaType === 'MOVIE' ? '🎬' : '📺'}</span>
        <span className="text-xs text-center px-2 line-clamp-2 text-white font-medium">{arrival.mediaTitle}</span>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-full">Voir</span>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-gray-400 hover:text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Marquer comme lu"
            title="Marquer comme lu"
          >
            ×
          </button>
        )}
      </div>

      {/* Info below card */}
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{arrival.mediaTitle}</p>
        {arrival.sourceName && (
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{arrival.sourceName}</p>
        )}
        <p className="text-gray-600 text-xs mt-0.5">{relativeTime(arrival.arrivedAt)}</p>
      </div>
    </div>
  )
}
