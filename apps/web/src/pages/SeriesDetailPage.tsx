import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { SeriesDetailResponse } from '@iptvflix/api-contracts'
import { getSeries, ApiError } from '../lib/api.js'
import Badge from '../components/ui/Badge.js'
import Button from '../components/ui/Button.js'
import Skeleton from '../components/ui/Skeleton.js'
import ErrorState from '../components/ui/ErrorState.js'
import WatchlistButton from '../components/content/WatchlistButton.js'
import SeasonAccordion from '../components/detail/SeasonAccordion.js'

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
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-20 h-5" />
            </div>
            <div className="flex gap-2 mb-4">
              <Skeleton className="w-16 h-5" />
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
  const [series, setSeries] = useState<SeriesDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    setError(null)
    getSeries(id)
      .then(setSeries)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <DetailSkeleton />

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-300 text-lg">Cette série est introuvable.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>← Retour</Button>
      </div>
    )
  }

  if (error) return <ErrorState message={error.message} onRetry={() => navigate(-1)} />
  if (!series) return null

  const showOriginalTitle = series.originalTitle && series.originalTitle !== series.title

  return (
    <div>
      {/* Backdrop */}
      <div className="relative h-[50vh] min-h-72 overflow-hidden">
        {series.backdropUrl ? (
          <img
            src={series.backdropUrl}
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
          {series.posterUrl && (
            <div className="hidden md:block flex-shrink-0 w-40 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={series.posterUrl} alt={series.title} className="w-full" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-bold text-white mb-1">{series.title}</h1>
            {showOriginalTitle && (
              <p className="text-gray-400 text-base mb-3">{series.originalTitle}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {series.year && <span className="text-gray-400 text-sm">{series.year}</span>}
              {series.seasonCount > 0 && (
                <span className="text-gray-400 text-sm">
                  {series.seasonCount} saison{series.seasonCount > 1 ? 's' : ''}
                </span>
              )}
              <Badge variant={series.availabilityStatus === 'AVAILABLE' ? 'available' : 'unavailable'}>
                {series.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Indisponible'}
              </Badge>
              {series.enrichmentStatus === 'unmatched' && (
                <Badge variant="unavailable">Données manquantes</Badge>
              )}
              {series.enrichmentStatus === 'partial' && (
                <Badge variant="default">Données partielles</Badge>
              )}
            </div>

            {/* Genres */}
            {series.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {series.genres.map((g) => (
                  <Badge key={g} variant="info">{g}</Badge>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {series.synopsis && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">
                {series.synopsis}
              </p>
            )}

            {/* Seasons */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-white mb-3">Saisons</h2>
              <SeasonAccordion seriesId={series.id} seasons={series.seasons} />
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                ← Retour
              </Button>
              <WatchlistButton mediaType="SERIES" mediaId={series.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
