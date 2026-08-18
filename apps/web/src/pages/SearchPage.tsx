import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type {
  MovieResponse,
  SeriesResponse,
  ExternalMovieCandidate,
  ExternalSeriesCandidate,
} from '@iptvflix/api-contracts'
import { searchContent, searchDiscover, materializeMovie, materializeSeries } from '../lib/api.js'
import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
import PosterCard from '../components/content/PosterCard.js'
import Spinner from '../components/ui/Spinner.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { useOpenDetail } from '../hooks/useOpenDetail.js'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const openDetail = useOpenDetail()
  const { emit: emitEvent } = useInteractionEvents()
  const initial = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initial)
  const debouncedQuery = useDebounce(query, 300)

  const [movies, setMovies] = useState<MovieResponse[]>([])
  const [series, setSeries] = useState<SeriesResponse[]>([])
  const [externalMovies, setExternalMovies] = useState<ExternalMovieCandidate[]>([])
  const [externalSeries, setExternalSeries] = useState<ExternalSeriesCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [externalError, setExternalError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMovies([])
      setSeries([])
      setExternalMovies([])
      setExternalSeries([])
      setError(null)
      setExternalError(null)
      return
    }

    setLoading(true)
    setExternalLoading(true)
    setError(null)
    setExternalError(null)

    emitEvent({
      eventType: 'SEARCH_PERFORMED',
      searchQueryNormalized: debouncedQuery.trim().toLowerCase(),
      clientType: 'web',
    })

    searchContent(debouncedQuery)
      .then(({ movies: m, series: s }) => {
        setMovies(m)
        setSeries(s)
      })
      .catch((err: Error) => {
        setError(err)
        setMovies([])
        setSeries([])
      })
      .finally(() => setLoading(false))

    searchDiscover(debouncedQuery)
      .then(({ externalMovies: em, externalSeries: es }) => {
        setExternalMovies(em)
        setExternalSeries(es)
      })
      .catch(() => {
        setExternalMovies([])
        setExternalSeries([])
      })
      .finally(() => setExternalLoading(false))
  }, [debouncedQuery, retryCount])

  // Sync query into URL
  useEffect(() => {
    if (query.trim()) setSearchParams({ q: query })
    else setSearchParams({})
  }, [query, setSearchParams])

  const total = movies.length + series.length
  const hasExternal = externalMovies.length > 0 || externalSeries.length > 0
  const showExternal = hasExternal || externalLoading

  async function handleExternalMovieClick(candidate: ExternalMovieCandidate) {
    setExternalError(null)
    try {
      const { id } = await materializeMovie(candidate.tmdbId)
      openDetail('movie', id)
    } catch {
      setExternalError("Impossible d'ouvrir ce titre. Veuillez réessayer.")
    }
  }

  async function handleExternalSeriesClick(candidate: ExternalSeriesCandidate) {
    setExternalError(null)
    try {
      const { id } = await materializeSeries(candidate.tmdbId)
      openDetail('series', id)
    } catch {
      setExternalError("Impossible d'ouvrir ce titre. Veuillez réessayer.")
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
                onClick={() => {
                  emitEvent({ eventType: 'SEARCH_RESULT_OPENED', mediaType: 'MOVIE', mediaId: m.id, searchQueryNormalized: debouncedQuery.trim().toLowerCase(), clientType: 'web' })
                  openDetail('movie', m.id)
                }}
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
                onClick={() => {
                  emitEvent({ eventType: 'SEARCH_RESULT_OPENED', mediaType: 'SERIES', mediaId: s.id, searchQueryNormalized: debouncedQuery.trim().toLowerCase(), clientType: 'web' })
                  openDetail('series', s.id)
                }}
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
          {externalError && (
            <p role="alert" className="text-red-400 text-sm mb-4">{externalError}</p>
          )}

          {externalLoading && <Spinner />}

          {!externalLoading && externalMovies.length > 0 && (
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

          {!externalLoading && externalSeries.length > 0 && (
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
