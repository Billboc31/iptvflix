import { useState, useEffect } from 'react'
import { fetchShelves } from '../lib/api.js'
import type { ShelfSummaryResponse } from '@iptvflix/api-contracts'

export type UseShelvesResult = {
  shelves: ShelfSummaryResponse[]
  loading: boolean
  error: Error | null
}

export function useShelves(): UseShelvesResult {
  const [shelves, setShelves] = useState<ShelfSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchShelves()
      .then(setShelves)
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  return { shelves, loading, error }
}
