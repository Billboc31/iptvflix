import type { EpisodeResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'

type Props = {
  episode: EpisodeResponse
}

export default function EpisodeRow({ episode }: Props) {
  const durationLabel = episode.durationMinutes ? `${episode.durationMinutes} min` : null
  const airLabel = episode.airDate
    ? new Date(episode.airDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  return (
    <div className="flex gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="flex-shrink-0 w-8 text-right text-gray-500 text-sm pt-0.5">
        {episode.episodeNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-gray-200 text-sm font-medium">
            {episode.title ?? `Épisode ${episode.episodeNumber}`}
          </span>
          <Badge variant={episode.availabilityStatus === 'AVAILABLE' ? 'available' : 'unavailable'}>
            {episode.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Indisponible'}
          </Badge>
        </div>
        {episode.synopsis && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-1">
            {episode.synopsis}
          </p>
        )}
        <div className="flex flex-wrap gap-3 text-gray-500 text-xs">
          {durationLabel && <span>{durationLabel}</span>}
          {airLabel && <span>{airLabel}</span>}
        </div>
      </div>
    </div>
  )
}
