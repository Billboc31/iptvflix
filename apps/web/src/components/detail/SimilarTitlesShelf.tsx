import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MovieResponse, SeriesResponse } from '@iptvflix/api-contracts'
import { getSimilarMovies, getSimilarSeries } from '../../lib/api.js'
import HorizontalRow from '../content/HorizontalRow.js'
import PosterCard from '../content/PosterCard.js'
import Skeleton from '../ui/Skeleton.js'

type SimilarMovie = MovieResponse & { _kind: 'MOVIE' }
type SimilarSeries = SeriesResponse & { _kind: 'SERIES' }
type SimilarEntry = SimilarMovie | SimilarSeries

type Props = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
}

export default function SimilarTitlesShelf({ mediaType, mediaId }: Props) {
  const navigate = useNavigate()
  const [items, setItems] = useState<SimilarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const fetch = mediaType === 'MOVIE'
      ? getSimilarMovies(mediaId).then((r) => r.map((m) => ({ ...m, _kind: 'MOVIE' as const })))
      : getSimilarSeries(mediaId).then((r) => r.map((s) => ({ ...s, _kind: 'SERIES' as const })))
    fetch
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [mediaType, mediaId])

  if (loading) {
    return (
      <section className="mb-8 px-4 md:px-8">
        <h2 className="text-lg font-semibold text-white mb-3 px-1">Titres similaires</h2>
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32">
              <Skeleton className="aspect-[2/3] rounded-lg w-full" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error || items.length === 0) return null

  return (
    <HorizontalRow title="Titres similaires">
      {items.map((item) => {
        const route = item._kind === 'MOVIE' ? `/movies/${item.id}` : `/series/${item.id}`
        const badge =
          item.availabilityStatus === 'UNAVAILABLE'
            ? { label: 'Indisponible', variant: 'unavailable' as const }
            : undefined
        const quality = '_kind' in item && item._kind === 'MOVIE' ? (item as SimilarMovie).quality : undefined
        return (
          <div key={item.id} className="flex-shrink-0 w-32 snap-start">
            <PosterCard
              title={item.title}
              year={item.year}
              posterUrl={item.posterUrl}
              quality={quality ?? null}
              badge={badge}
              onClick={() => navigate(route)}
            />
          </div>
        )
      })}
    </HorizontalRow>
  )
}
