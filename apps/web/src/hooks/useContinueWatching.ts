import { useState, useEffect } from 'react'
import { fetchContinueWatching } from '../lib/api.js'
import type { ContinueWatchingItem } from '@iptvflix/api-contracts'

export type UseContinueWatchingResult = {
  items: ContinueWatchingItem[]
  loading: boolean
  error: Error | null
}

export function useContinueWatching(): UseContinueWatchingResult {
  const [items, setItems] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchContinueWatching()
      .then(setItems)
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  return { items, loading, error }
}
