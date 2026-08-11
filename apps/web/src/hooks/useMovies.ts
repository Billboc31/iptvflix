import { useState, useEffect, useCallback } from 'react'
import type { MovieFilters, PaginatedList, MovieResponse } from '@iptvflix/api-contracts'
import { listMovies } from '../lib/api.js'

export type MoviesState = {
  data: PaginatedList<MovieResponse> | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useMovies(filters: MovieFilters = {}): MoviesState {
  const filtersKey = JSON.stringify(filters)
  const [data, setData] = useState<PaginatedList<MovieResponse> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setData(await listMovies(JSON.parse(filtersKey) as MovieFilters))
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
    // filtersKey is the serialized representation of filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
