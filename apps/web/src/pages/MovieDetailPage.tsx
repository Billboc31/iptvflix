import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { MovieDetailResponse, AvailabilityVariantResponse } from '@iptvflix/api-contracts'
import { getMovie, fetchContinueWatching, ApiError } from '../lib/api.js'
import { useDevices } from '../hooks/useDevices.js'
import { useToast } from '../components/ui/Toast.js'
import Badge from '../components/ui/Badge.js'
import Button from '../components/ui/Button.js'
import Skeleton from '../components/ui/Skeleton.js'
import ErrorState from '../components/ui/ErrorState.js'
import WatchlistButton from '../components/content/WatchlistButton.js'
import FeedbackButtons from '../components/content/FeedbackButtons.js'
import TrailerPlayer from '../components/detail/TrailerPlayer.js'
import CastRow from '../components/detail/CastRow.js'
import DevicePickerModal from '../components/devices/DevicePickerModal.js'

function DetailSkeleton() {
  return (
    <div>
      <div className="relative h-[50vh] min-h-72 overflow-hidden">
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      </div>
      <div className="px-8 py-6 -mt-24 relative">
        <div className="flex gap-6 items-start">
          <div className="hidden md:block flex-shrink-0 w-40 rounded-xl overflow-hidden">
            <Skeleton height="240px" />
          </div>
          <div className="flex-1 min-w-0">
            <Skeleton className="w-64 h-10 mb-3" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="w-12 h-5" />
              <Skeleton className="w-16 h-5" />
              <Skeleton className="w-20 h-5" />
            </div>
            <div className="flex gap-2 mb-4">
              <Skeleton className="w-16 h-5" />
              <Skeleton className="w-20 h-5" />
            </div>
            <Skeleton className="w-full h-4 mb-2" />
            <Skeleton className="w-4/5 h-4 mb-2" />
            <Skeleton className="w-3/5 h-4 mb-6" />
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantBadge({ variant }: { variant: AvailabilityVariantResponse }) {
  const parts = []
  if (variant.audioLanguage) parts.push(variant.audioLanguage.toUpperCase())
  if (variant.subtitleLanguage) parts.push(`sub:${variant.subtitleLanguage}`)
  if (variant.videoQuality) parts.push(variant.videoQuality)
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
        variant.status === 'AVAILABLE'
          ? 'border-white/20 text-gray-300'
          : 'border-white/10 text-gray-600 line-through'
      }`}
    >
      {parts.length > 0 ? parts.join(' · ') : 'Inconnu'}
    </span>
  )
}

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { devices } = useDevices()
  const [movie, setMovie] = useState<MovieDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [progressMs, setProgressMs] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    setError(null)
    Promise.allSettled([getMovie(id), fetchContinueWatching()])
      .then(([movieResult, cwResult]) => {
        if (movieResult.status === 'rejected') {
          const err = movieResult.reason as Error
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true)
          } else {
            setError(err)
          }
          return
        }
        const m = movieResult.value
        setMovie(m)
        setSelectedVariantId(m.selectedVariantId)
        if (cwResult.status === 'fulfilled') {
          const item = cwResult.value.find((i) => i.mediaType === 'MOVIE' && i.mediaId === id)
          setProgressMs(item ? item.progressSeconds * 1000 : 0)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <DetailSkeleton />

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-300 text-lg">Ce film est introuvable.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>← Retour</Button>
      </div>
    )
  }

  if (error) return <ErrorState message={error.message} onRetry={() => navigate(-1)} />
  if (!movie) return null

  const showOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title

  return (
    <div>
      {/* Backdrop */}
      <div className="relative h-[50vh] min-h-72 overflow-hidden">
        {movie.backdropUrl ? (
          <img
            src={movie.backdropUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="px-8 py-6 -mt-24 relative">
        <div className="flex gap-6 items-start">
          {/* Poster */}
          {movie.posterUrl && (
            <div className="hidden md:block flex-shrink-0 w-40 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={movie.posterUrl} alt={movie.title} className="w-full" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-bold text-white mb-1">{movie.title}</h1>
            {showOriginalTitle && (
              <p className="text-gray-400 text-base mb-3">{movie.originalTitle}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {movie.year && (
                <span className="text-gray-400 text-sm">{movie.year}</span>
              )}
              {movie.runtime && (
                <span className="text-gray-400 text-sm">{movie.runtime} min</span>
              )}
              {movie.certification && (
                <Badge variant="default">{movie.certification}</Badge>
              )}
              {movie.voteAverage !== null && (
                <span className="text-yellow-400 text-sm font-medium">★ {movie.voteAverage.toFixed(1)}</span>
              )}
              {movie.quality && <Badge variant="quality">{movie.quality}</Badge>}
              <Badge variant={movie.availabilityStatus === 'AVAILABLE' ? 'available' : 'unavailable'}>
                {movie.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Indisponible'}
              </Badge>
              {movie.enrichmentStatus === 'unmatched' && (
                <Badge variant="unavailable">Données manquantes</Badge>
              )}
              {movie.enrichmentStatus === 'partial' && (
                <Badge variant="default">Données partielles</Badge>
              )}
            </div>

            {/* Genres */}
            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres.map((g) => (
                  <Badge key={g} variant="info">{g}</Badge>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {movie.synopsis && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">
                {movie.synopsis}
              </p>
            )}

            {/* Trailer */}
            <TrailerPlayer trailerKey={movie.trailerKey} title={movie.title} />

            {/* Variant selector */}
            {movie.variants.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Version disponible
                </p>
                <div className="flex flex-wrap gap-2">
                  {movie.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => v.status === 'AVAILABLE' && setSelectedVariantId(v.id)}
                      className={`cursor-pointer transition-opacity ${
                        v.status !== 'AVAILABLE' ? 'opacity-40 cursor-not-allowed' : ''
                      } ${
                        selectedVariantId === v.id
                          ? 'ring-2 ring-[#e50914] rounded'
                          : ''
                      }`}
                    >
                      <VariantBadge variant={v} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            <CastRow cast={movie.cast} director={movie.director} />

            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                ← Retour
              </Button>
              {movie.availabilityStatus === 'AVAILABLE' && (
                <Button
                  onClick={() =>
                    navigate(
                      `/player/movie/${movie.id}${
                        selectedVariantId ? `?availabilityId=${selectedVariantId}` : ''
                      }`,
                    )
                  }
                >
                  ▶ Lecture
                </Button>
              )}
              {devices.length > 0 && (
                <Button variant="secondary" onClick={() => setPickerOpen(true)}>
                  📺 Lire sur TV
                </Button>
              )}
              <WatchlistButton mediaType="MOVIE" mediaId={movie.id} />
              <FeedbackButtons mediaType="MOVIE" mediaId={movie.id} />
            </div>
            <DevicePickerModal
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              devices={devices}
              mediaType="movie"
              mediaId={movie.id}
              availabilityId={selectedVariantId}
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
          </div>
        </div>
      </div>
    </div>
  )
}
