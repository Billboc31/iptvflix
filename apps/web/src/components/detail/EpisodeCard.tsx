import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EpisodeResponse, DeviceResponse } from '@iptvflix/api-contracts'
import { useToast } from '../ui/Toast.js'
import DevicePickerModal from '../devices/DevicePickerModal.js'
import { formatVariantLabel } from '../../lib/variant-label.js'

type Props = {
  episode: EpisodeResponse
  devices?: DeviceResponse[]
  progressMs?: number
  seriesId?: string
  seasonNumber?: number
}

export default function EpisodeCard({ episode, devices = [], progressMs = 0, seriesId, seasonNumber }: Props) {
  const navigate = useNavigate()
  const toast = useToast()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedVariantId, setPickedVariantId] = useState<string | null>(episode.selectedVariantId)

  const durationLabel = episode.durationMinutes ? `${episode.durationMinutes} min` : null
  const airLabel = episode.airDate
    ? new Date(episode.airDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  const isUnavailable = episode.availabilityStatus === 'UNAVAILABLE'
  const availableVariants = episode.variants.filter((v) => v.status === 'AVAILABLE')
  const activeVariantId = pickedVariantId ?? episode.selectedVariantId

  return (
    <div className={`flex gap-3 md:gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${isUnavailable ? 'opacity-60' : ''}`}>
      {/* Episode number */}
      <span className="flex-shrink-0 w-7 text-right text-gray-500 text-sm pt-1 font-mono">
        {episode.episodeNumber}
      </span>

      {/* Still image */}
      <div className="flex-shrink-0 w-24 md:w-36 aspect-video bg-[#1a1a24] rounded overflow-hidden flex items-center justify-center">
        {episode.posterUrl ? (
          <img src={episode.posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-600 text-2xl" aria-hidden="true">🎬</span>
        )}
      </div>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2 mb-1">
          <span className="text-gray-100 text-sm font-medium leading-tight">
            {episode.title ?? `Épisode ${episode.episodeNumber}`}
          </span>
          {episode.watchState === 'watched' && (
            <span aria-label="Vu" className="text-green-400 text-xs font-medium flex-shrink-0">✓ Vu</span>
          )}
          {episode.watchState === 'in_progress' && (
            <span aria-label="En cours" className="text-blue-400 text-xs font-medium flex-shrink-0">◑ En cours</span>
          )}
        </div>

        {episode.synopsis && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-2">
            {episode.synopsis}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-gray-500 text-xs">
          {durationLabel && <span>{durationLabel}</span>}
          {airLabel && <span>{airLabel}</span>}
          {isUnavailable ? (
            <span className="text-gray-600">Indisponible</span>
          ) : (
            <>
              {availableVariants.length > 1 && (
                <select
                  value={activeVariantId ?? ''}
                  onChange={(e) => setPickedVariantId(e.target.value || null)}
                  className="bg-[#1a1a24] border border-white/20 rounded px-1 py-0.5 text-gray-300 text-xs cursor-pointer"
                  aria-label="Sélectionner la source"
                >
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVariantLabel(v, availableVariants)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams()
                  if (activeVariantId) params.set('availabilityId', activeVariantId)
                  if (seriesId) params.set('seriesId', seriesId)
                  if (seasonNumber != null) params.set('seasonNumber', String(seasonNumber))
                  const qs = params.toString()
                  navigate(`/player/episode/${episode.id}${qs ? `?${qs}` : ''}`)
                }}
                className="inline-flex items-center min-h-[44px] text-[#e50914] hover:text-[#e50914]/80 font-medium transition-colors"
                aria-label={
                  progressMs > 30_000
                    ? `Reprendre l'épisode ${episode.episodeNumber}`
                    : `Lire l'épisode ${episode.episodeNumber}`
                }
              >
                ▶ {progressMs > 30_000 ? 'Reprendre' : 'Lire'}
              </button>
              {devices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center min-h-[44px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  aria-label={`Lire l'épisode ${episode.episodeNumber} sur TV`}
                >
                  📺 TV
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {pickerOpen && (
        <DevicePickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          devices={devices}
          mediaType="episode"
          mediaId={episode.id}
          availabilityId={activeVariantId}
          progressMs={progressMs}
          onFastPath={(name, state) => {
            if (state === 'delivered') {
              toast.show(`Lecture lancée sur ${name}`, 'success')
            } else if (state === 'device-offline') {
              toast.show(`${name} est hors ligne`, 'error')
            } else {
              toast.show('Erreur lors de l\'envoi de la commande', 'error')
            }
          }}
        />
      )}
    </div>
  )
}
