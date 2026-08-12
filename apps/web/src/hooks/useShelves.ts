import { useState, useEffect, useCallback } from 'react'
import { fetchShelves } from '../lib/api.js'
import type { ShelfSummaryResponse } from '@iptvflix/api-contracts'

export type UseShelvesResult = {
  shelves: ShelfSummaryResponse[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useShelves(): UseShelvesResult {
  const [shelves, setShelves] = useState<ShelfSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setShelves(await fetchShelves())
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { shelves, loading, error, refetch }
}
