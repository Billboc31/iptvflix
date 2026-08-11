import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type {
  MovieResponse,
  SeriesResponse,
  ExternalMovieCandidate,
  ExternalSeriesCandidate,
} from '@iptvflix/api-contracts'
import { searchContent, materializeMovie, materializeSeries } from '../lib/api.js'
import PosterCard from '../components/content/PosterCard.js'
import Spinner from '../components/ui/Spinner.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import { useDebounce } from '../hooks/useDebounce.js'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const initial = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initial)
  const debouncedQuery = useDebounce(query, 300)

  const [movies, setMovies] = useState<MovieResponse[]>([])
  const [series, setSeries] = useState<SeriesResponse[]>([])
  const [externalMovies, setExternalMovies] = useState<ExternalMovieCandidate[]>([])
  const [externalSeries, setExternalSeries] = useState<ExternalSeriesCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMovies([])
      setSeries([])
      setExternalMovies([])
      setExternalSeries([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    searchContent(debouncedQuery)
      .then(({ movies: m, series: s, externalMovies: em, externalSeries: es }) => {
        setMovies(m)
        setSeries(s)
        setExternalMovies(em)
        setExternalSeries(es)
      })
      .catch((err: Error) => {
        setError(err)
        setMovies([])
        setSeries([])
        setExternalMovies([])
        setExternalSeries([])
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, retryCount])

  // Sync query into URL
  useEffect(() => {
    if (query.trim()) setSearchParams({ q: query })
    else setSearchParams({})
  }, [query, setSearchParams])

  const total = movies.length + series.length
  const hasExternal = externalMovies.length > 0 || externalSeries.length > 0
  const showExternal = hasExternal && total <= 5

  async function handleExternalMovieClick(candidate: ExternalMovieCandidate) {
    try {
      const { id } = await materializeMovie(candidate.tmdbId)
      navigate(`/movies/${id}`)
    } catch {
      // silently ignore — user can retry
    }
  }

  async function handleExternalSeriesClick(candidate: ExternalSeriesCandidate) {
    try {
      const { id } = await materializeSeries(candidate.tmdbId)
      navigate(`/series/${id}`)
    } catch {
      // silently ignore
    }
  }

  function externalMovieBadge(candidate: ExternalMovieCandidate) {
    if (candidate.releaseStatus && candidate.releaseStatus !== 'Released') {
      return { label: 'À venir', variant: 'upcoming' as const }
    }
    return { label: 'Non disponible', variant: 'unavailable' as const }
  }

  function externalSeriesBadge(candidate: ExternalSeriesCandidate) {
    if (candidate.releaseStatus && candidate.releaseStatus !== 'Released') {
      return { label: 'À venir', variant: 'upcoming' as const }
    }
    return { label: 'Non disponible', variant: 'unavailable' as const }
  }

  return (
    <div className="px-8 py-6">
      <h1 className="text-3xl font-bold text-white mb-6">Recherche</h1>

      <div className="flex items-center gap-3 mb-8 max-w-lg">
        <span className="text-gray-500">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher films, séries…"
          autoFocus
          className="flex-1 bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50 text-sm"
        />
      </div>

      {loading && <Spinner />}

      {!loading && error && (
        <ErrorState
          message="Une erreur est survenue lors de la recherche."
          onRetry={() => {
            setError(null)
            setRetryCount((c) => c + 1)
          }}
        />
      )}

      {!loading && !error && query.trim() && total === 0 && !showExternal && (
        <EmptyState
          icon="🔎"
          heading="Aucun résultat"
          description={`Aucun contenu trouvé pour « ${query} ».`}
        />
      )}

      {!loading && !error && movies.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Films <span className="text-gray-500 text-sm">({movies.length})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {movies.map((m) => (
              <PosterCard
                key={m.id}
                title={m.title}
                year={m.year}
                posterUrl={m.posterUrl}
                quality={m.quality}
                onClick={() => navigate(`/movies/${m.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && series.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Séries <span className="text-gray-500 text-sm">({series.length})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {series.map((s) => (
              <PosterCard
                key={s.id}
                title={s.title}
                year={s.year}
                posterUrl={s.posterUrl}
                onClick={() => navigate(`/series/${s.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && showExternal && (
        <section>
          <h2 className="text-lg font-semibold text-gray-400 mb-1">
            Aussi trouvé en dehors de votre catalogue
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Ces titres ne sont pas disponibles dans vos sources configurées.
          </p>

          {externalMovies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Films</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {externalMovies.map((m) => (
                  <PosterCard
                    key={m.tmdbId}
                    title={m.title}
                    year={m.year}
                    posterUrl={m.posterUrl}
                    badge={externalMovieBadge(m)}
                    onClick={() => handleExternalMovieClick(m)}
                  />
                ))}
              </div>
            </div>
          )}

          {externalSeries.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Séries</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {externalSeries.map((s) => (
                  <PosterCard
                    key={s.tmdbId}
                    title={s.title}
                    year={s.year}
                    posterUrl={s.posterUrl}
                    badge={externalSeriesBadge(s)}
                    onClick={() => handleExternalSeriesClick(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
