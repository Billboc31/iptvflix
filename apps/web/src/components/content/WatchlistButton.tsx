import { useWatchlist } from '../../hooks/useWatchlist.js'
import type { WatchlistMediaType } from '@iptvflix/api-contracts'

type WatchlistButtonProps = {
  mediaType: WatchlistMediaType
  mediaId: string
}

export default function WatchlistButton({ mediaType, mediaId }: WatchlistButtonProps) {
  const { entries, add, remove } = useWatchlist()
  const isInList = entries.some((e) => e.mediaType === mediaType && e.mediaId === mediaId)

  const handleClick = () => {
    if (isInList) {
      remove(mediaType, mediaId)
    } else {
      add(mediaType, mediaId)
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isInList ? 'Retirer de Ma liste' : 'Ajouter à Ma liste'}
      title={isInList ? 'Retirer de Ma liste' : 'Ajouter à Ma liste'}
      className="flex items-center gap-2 px-4 py-2 rounded border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors"
    >
      <span className="text-lg leading-none">{isInList ? '✓' : '+'}</span>
      <span>Ma liste</span>
    </button>
  )
}
