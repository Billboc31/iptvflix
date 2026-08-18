import { useEffect, useState, type ReactElement } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { SeriesDetailResponse } from '@iptvflix/api-contracts'
import { getSeries, getProfile, fetchContinueWatching, ApiError } from '../lib/api.js'
import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
import { useDevices } from '../hooks/useDevices.js'
import Badge from '../components/ui/Badge.js'
import Button from '../components/ui/Button.js'
import Skeleton from '../components/ui/Skeleton.js'
import ErrorState from '../components/ui/ErrorState.js'
import CastRow from '../components/detail/CastRow.js'
import MediaHero from '../components/detail/MediaHero.js'
import MediaMetadata from '../components/detail/MediaMetadata.js'
import MediaActions from '../components/detail/MediaActions.js'
import SeasonSelector from '../components/detail/SeasonSelector.js'
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
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-20 h-5" />
            </div>
            <Skeleton className="w-full h-4 mb-2" />
            <Skeleton className="w-4/5 h-4 mb-6" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { devices } = useDevices()
  const { emit: emitEvent } = useInteractionEvents()
  const [series, setSeries] = useState<SeriesDetailResponse | null>(null)

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [profileId, setProfileId] = useState<string | undefined>(undefined)
  const [progressByEpisodeId, setProgressByEpisodeId] = useState<Record<string, number>>({})

  useEffect(() => {
    getProfile()
      .then((p) => setProfileId(p.id))
      .catch(() => {/* profile unavailable — watchState will be null */})
  }, [])

  useEffect(() => {
    fetchContinueWatching()
      .then((items) => {
        const map: Record<string, number> = {}
        for (const item of items) {
          if (item.mediaType === 'EPISODE') {
            map[item.mediaId] = item.progressSeconds * 1000
          }
        }
        setProgressByEpisodeId(map)
      })
      .catch(() => {/* progress unavailable */})
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError(null)

    async function load(initial: boolean) {
      try {
        const s = await getSeries(id!)
        if (cancelled) return
        setSeries(s)
        if (initial) {
          setLoading(false)
          emitEvent({ eventType: 'DETAIL_OPENED', mediaType: 'SERIES', mediaId: id!, clientType: 'web' })
        }
        return s
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err as Error)
        }
        if (initial) setLoading(false)
        return null
      }
    }

    void load(true).then(async (s) => {
      if (!s || s.seasons.length > 0) return
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        if (cancelled) return
        const next = await load(false)
        if (next && next.seasons.length > 0) return
      }
    })

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return modal(<DetailSkeleton />)

  if (notFound) {
    return modal(
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-300 text-lg">Cette série est introuvable.</p>
        <Button variant="ghost" onClick={handleClose}>← Retour</Button>
      </div>,
    )
  }

  if (error) return modal(<ErrorState message={error.message} onRetry={handleClose} />)
  if (!series) return null

  return modal(
    <div className="bg-[#0a0a0f] min-h-screen">
      <MediaHero
        backdropUrl={series.backdropUrl}
        posterUrl={series.posterUrl}
        trailerKey={series.trailerKey}
        title={series.title}
      />

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
        <div className="flex gap-6 items-start">
          {/* Poster sidebar — desktop only, overlaps hero */}
          {series.posterUrl && (
            <div className="hidden md:block flex-shrink-0 w-44 -mt-24 relative z-10 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={series.posterUrl} alt={series.title} className="w-full" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Enrichment badges */}
            {series.enrichmentStatus === 'unmatched' && (
              <div className="mb-3">
                <Badge variant="unavailable">Données manquantes</Badge>
              </div>
            )}
            {series.enrichmentStatus === 'partial' && (
              <div className="mb-3">
                <Badge variant="default">Données partielles</Badge>
              </div>
            )}

            <MediaMetadata
              title={series.title}
              originalTitle={series.originalTitle}
              year={series.year}
              genres={series.genres}
              certification={series.certification}
              voteAverage={series.voteAverage}
              synopsis={series.synopsis}
              seasonCount={series.seasonCount}
              status={series.status}
            />

            <MediaActions
              mediaType="SERIES"
              mediaId={series.id}
              availabilityStatus={series.availabilityStatus}
              /* No playRoute for series — episode playback is handled in SeasonSelector */
            />

            <CastRow cast={series.cast} director={series.director} />

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-white mb-3">Saisons</h2>
              <SeasonSelector
                key={series.id}
                seriesId={series.id}
                seasons={series.seasons}
                profileId={profileId}
                devices={devices}
                progressByEpisodeId={progressByEpisodeId}
              />
            </div>
          </div>
        </div>
      </div>

      <SimilarTitlesShelf mediaType="SERIES" mediaId={series.id} />
    </div>,
  )
}
