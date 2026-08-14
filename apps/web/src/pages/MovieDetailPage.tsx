import { useEffect, useState, type ReactElement } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { MovieDetailResponse } from '@iptvflix/api-contracts'
import { getMovie, fetchContinueWatching, ApiError } from '../lib/api.js'
import { useDevices } from '../hooks/useDevices.js'
import { useToast } from '../components/ui/Toast.js'
import Badge from '../components/ui/Badge.js'
import Button from '../components/ui/Button.js'
import Skeleton from '../components/ui/Skeleton.js'
import ErrorState from '../components/ui/ErrorState.js'
import CastRow from '../components/detail/CastRow.js'
import DevicePickerModal from '../components/devices/DevicePickerModal.js'
import MediaHero from '../components/detail/MediaHero.js'
import MediaMetadata from '../components/detail/MediaMetadata.js'
import MediaActions from '../components/detail/MediaActions.js'
import AvailabilityPanel from '../components/detail/AvailabilityPanel.js'
import SimilarTitlesShelf from '../components/detail/SimilarTitlesShelf.js'
import MediaDetailShell from '../components/detail/MediaDetailShell.js'

function DetailSkeleton() {
  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <Skeleton className="w-full rounded-none" style={{ height: 'clamp(300px, 56.25vw, 70vh)' }} />
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
        <div className="flex gap-6 items-start">
          <div className="hidden md:block flex-shrink-0 w-44 rounded-xl overflow-hidden">
            <Skeleton height="264px" />
          </div>
          <div className="flex-1 min-w-0">
            <Skeleton className="w-64 h-10 mb-3" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="w-12 h-5" />
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

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { devices } = useDevices()
  const [movie, setMovie] = useState<MovieDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [progressMs, setProgressMs] = useState(0)

  const modalState = location.state as { background?: Location; scrollY?: number } | null
  const isModal = !!modalState?.background
  const savedScrollY = modalState?.scrollY

  function handleClose() {
    navigate(-1)
  }

  function modal(content: ReactElement) {
    if (!isModal) return content
    return (
      <MediaDetailShell onClose={handleClose} scrollY={savedScrollY}>
        {content}
      </MediaDetailShell>
    )
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError(null)

    async function loadMovie() {
      const m = await getMovie(id!)
      if (cancelled) return m
      setMovie(m)
      setSelectedVariantId(m.selectedVariantId)
      return m
    }

    Promise.allSettled([loadMovie(), fetchContinueWatching()])
      .then(async ([movieResult, cwResult]) => {
        if (cancelled) return
        if (movieResult.status === 'rejected') {
          const err = movieResult.reason as Error
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true)
          } else {
            setError(err)
          }
          setLoading(false)
          return
        }
        if (cwResult.status === 'fulfilled') {
          const item = cwResult.value.find((i) => i.mediaType === 'MOVIE' && i.mediaId === id)
          setProgressMs(item ? item.progressSeconds * 1000 : 0)
        }
        setLoading(false)

        const first = movieResult.value
        if (!first || first.trailerKey || (first.cast?.length ?? 0) > 0 || !first.tmdbId) return
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          if (cancelled) return
          try {
            const next = await getMovie(id!)
            if (cancelled) return
            setMovie(next)
            setSelectedVariantId(next.selectedVariantId)
            if (next.trailerKey || (next.cast?.length ?? 0) > 0) return
          } catch {
            return
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return modal(<DetailSkeleton />)

  if (notFound) {
    return modal(
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-300 text-lg">Ce film est introuvable.</p>
        <Button variant="ghost" onClick={handleClose}>← Retour</Button>
      </div>,
    )
  }

  if (error) return modal(<ErrorState message={error.message} onRetry={handleClose} />)
  if (!movie) return null

  const playRoute = `/player/movie/${movie.id}${selectedVariantId ? `?availabilityId=${selectedVariantId}` : ''}`

  return modal(
    <div className="bg-[#0a0a0f] min-h-screen">
      <MediaHero
        backdropUrl={movie.backdropUrl}
        posterUrl={movie.posterUrl}
        trailerKey={movie.trailerKey}
        title={movie.title}
      />

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
        <div className="flex gap-6 items-start">
          {/* Poster sidebar — desktop only, overlaps hero */}
          {movie.posterUrl && (
            <div className="hidden md:block flex-shrink-0 w-44 -mt-24 relative z-10 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={movie.posterUrl} alt={movie.title} className="w-full" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Enrichment badges */}
            {movie.enrichmentStatus === 'unmatched' && (
              <div className="mb-3">
                <Badge variant="unavailable">Données manquantes</Badge>
              </div>
            )}
            {movie.enrichmentStatus === 'partial' && (
              <div className="mb-3">
                <Badge variant="default">Données partielles</Badge>
              </div>
            )}

            <MediaMetadata
              title={movie.title}
              originalTitle={movie.originalTitle}
              year={movie.year}
              runtime={movie.runtime}
              genres={movie.genres}
              certification={movie.certification}
              voteAverage={movie.voteAverage}
              synopsis={movie.synopsis}
            />

            <MediaActions
              mediaType="MOVIE"
              mediaId={movie.id}
              availabilityStatus={movie.availabilityStatus}
              playRoute={playRoute}
              onPlayOnTv={() => setPickerOpen(true)}
              showPlayOnTv={devices.length > 0}
            />

            <AvailabilityPanel
              variants={movie.variants}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />

            <CastRow cast={movie.cast} director={movie.director} />
          </div>
        </div>
      </div>

      <SimilarTitlesShelf mediaType="MOVIE" mediaId={movie.id} />

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
    </div>,
  )
}
