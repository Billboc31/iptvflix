import { useState, useEffect } from 'react'
import { fetchContinueWatching } from '../lib/api.js'
import { useProfile } from '../context/ProfileContext.js'
import type { ContinueWatchingItem } from '@iptvflix/api-contracts'

export type UseContinueWatchingResult = {
  items: ContinueWatchingItem[]
  loading: boolean
  error: Error | null
}

export function useContinueWatching(): UseContinueWatchingResult {
  const { profileVersion } = useProfile()
  const [items, setItems] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setItems([])
    setLoading(true)
    setError(null)
    fetchContinueWatching()
      .then(setItems)
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false))
  }, [profileVersion])

  return { items, loading, error }
}
