import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
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
  const location = useLocation()
  const [items, setItems] = useState<SimilarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(false)
    const fetchPromise = mediaType === 'MOVIE'
      ? getSimilarMovies(mediaId).then((r) => r.map((m) => ({ ...m, _kind: 'MOVIE' as const })))
      : getSimilarSeries(mediaId).then((r) => r.map((s) => ({ ...s, _kind: 'SERIES' as const })))
    fetchPromise
      .then((data) => { if (!stale) setItems(data) })
      .catch(() => { if (!stale) setError(true) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
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

  const modalState = location.state as { background?: Location; scrollY?: number } | null
  const modalBackground = modalState?.background
  const modalScrollY = modalState?.scrollY

  function openSimilar(kind: 'MOVIE' | 'SERIES', id: string) {
    const route = kind === 'MOVIE' ? `/movies/${id}` : `/series/${id}`
    if (modalBackground) {
      // Inside modal: replace current entry, preserving original background so × exits to browsing context
      navigate(route, { state: { background: modalBackground, scrollY: modalScrollY }, replace: true })
    } else {
      // Direct page view: open as new modal with current page as background
      navigate(route, { state: { background: location, scrollY: window.scrollY } })
    }
  }

  return (
    <HorizontalRow title="Titres similaires">
      {items.map((item) => {
        const badge =
          item.availabilityStatus === 'UNAVAILABLE'
            ? { label: 'Indisponible', variant: 'unavailable' as const }
            : undefined
        const quality = item._kind === 'MOVIE' ? (item as SimilarMovie).quality : undefined
        return (
          <div key={item.id} className="flex-shrink-0 w-32 snap-start">
            <PosterCard
              title={item.title}
              year={item.year}
              posterUrl={item.posterUrl}
              quality={quality ?? null}
              badge={badge}
              onClick={() => openSimilar(item._kind, item.id)}
            />
          </div>
        )
      })}
    </HorizontalRow>
  )
}
