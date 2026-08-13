import { useNavigate } from 'react-router-dom'
import type { EpisodeResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'

type Props = {
  episode: EpisodeResponse
}

export default function EpisodeRow({ episode }: Props) {
  const navigate = useNavigate()
  const durationLabel = episode.durationMinutes ? `${episode.durationMinutes} min` : null
  const airLabel = episode.airDate
    ? new Date(episode.airDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  const isUnavailable = episode.availabilityStatus === 'UNAVAILABLE'

  return (
    <div className={`flex gap-3 py-3 border-b border-white/5 last:border-0 ${isUnavailable ? 'opacity-50' : ''}`}>
      <span className="flex-shrink-0 w-8 text-right text-gray-500 text-sm pt-0.5">
        {episode.episodeNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-gray-200 text-sm font-medium">
            {episode.title ?? `Épisode ${episode.episodeNumber}`}
          </span>
          <Badge variant={isUnavailable ? 'unavailable' : 'available'}>
            {isUnavailable ? 'Indisponible' : 'Disponible'}
          </Badge>
          {episode.watchState === 'watched' && (
            <span aria-label="Vu" className="text-green-400 text-xs font-medium">✓ Vu</span>
          )}
          {episode.watchState === 'in_progress' && (
            <span aria-label="En cours" className="text-blue-400 text-xs font-medium">◑ En cours</span>
          )}
        </div>
        {episode.synopsis && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-1">
            {episode.synopsis}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-gray-500 text-xs">
          {durationLabel && <span>{durationLabel}</span>}
          {airLabel && <span>{airLabel}</span>}
          {!isUnavailable && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/player/episode/${episode.id}${
                    episode.selectedVariantId ? `?availabilityId=${episode.selectedVariantId}` : ''
                  }`,
                )
              }
              className="text-[#e50914] hover:text-[#e50914]/80 font-medium transition-colors"
              aria-label={`Lire l'épisode ${episode.episodeNumber}`}
            >
              ▶ Lire
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
