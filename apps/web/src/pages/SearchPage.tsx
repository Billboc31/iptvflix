import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { MovieResponse, SeriesResponse } from '@iptvflix/api-contracts'
import { searchContent } from '../lib/api.js'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMovies([])
      setSeries([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
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
  }, [debouncedQuery, retryCount])

  // Sync query into URL
  useEffect(() => {
    if (query.trim()) setSearchParams({ q: query })
    else setSearchParams({})
  }, [query, setSearchParams])

  const total = movies.length + series.length

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

      {!loading && !error && query.trim() && total === 0 && (
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
        <section>
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
    </div>
  )
}
