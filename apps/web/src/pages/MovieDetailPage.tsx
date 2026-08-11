import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { MovieResponse } from '@iptvflix/api-contracts'
import { getMovie } from '../lib/api.js'
import Badge from '../components/ui/Badge.js'
import Button from '../components/ui/Button.js'
import Spinner from '../components/ui/Spinner.js'
import ErrorState from '../components/ui/ErrorState.js'
import WatchlistButton from '../components/content/WatchlistButton.js'

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [movie, setMovie] = useState<MovieResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getMovie(id)
      .then(setMovie)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error.message} onRetry={() => navigate(-1)} />
  if (!movie) return null

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
            <h1 className="text-4xl font-bold text-white mb-3">{movie.title}</h1>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {movie.year && (
                <span className="text-gray-400 text-sm">{movie.year}</span>
              )}
              {movie.runtime && (
                <span className="text-gray-400 text-sm">{movie.runtime} min</span>
              )}
              {movie.quality && <Badge variant="quality">{movie.quality}</Badge>}
              <Badge variant={movie.availabilityStatus === 'AVAILABLE' ? 'available' : 'unavailable'}>
                {movie.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Indisponible'}
              </Badge>
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

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                ← Retour
              </Button>
              <WatchlistButton mediaType="MOVIE" mediaId={movie.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
