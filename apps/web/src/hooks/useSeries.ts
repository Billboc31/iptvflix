import { useState, useEffect, useCallback } from 'react'
import type { SeriesFilters, PaginatedList, SeriesResponse } from '@iptvflix/api-contracts'
import { listSeries } from '../lib/api.js'

export type SeriesState = {
  data: PaginatedList<SeriesResponse> | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useSeries(filters: SeriesFilters = {}): SeriesState {
  const filtersKey = JSON.stringify(filters)
  const [data, setData] = useState<PaginatedList<SeriesResponse> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listSeries(JSON.parse(filtersKey) as SeriesFilters))
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
