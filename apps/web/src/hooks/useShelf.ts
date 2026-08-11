import { useState, useEffect } from 'react'
import { fetchShelf } from '../lib/api.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

export type UseShelfResult = {
  shelf: ShelfResponse | null
  loading: boolean
  error: Error | null
}

export function useShelf(id: string): UseShelfResult {
  const [shelf, setShelf] = useState<ShelfResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchShelf(id)
      .then(setShelf)
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false))
  }, [id])

  return { shelf, loading, error }
}
