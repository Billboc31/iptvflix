import { useState, useEffect, useCallback } from 'react'
import { fetchArrivals } from '../lib/api.js'
import type { ArrivalItem } from '@iptvflix/api-contracts'

export type UseArrivalsResult = {
  arrivals: ArrivalItem[]
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

export function useArrivals(filter: 'unread' | 'all' = 'unread'): UseArrivalsResult {
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchArrivals(filter)
      .then((result) => {
        if (!cancelled) {
          setArrivals(result)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error)
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filter, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return { arrivals, isLoading, error, refresh }
}
