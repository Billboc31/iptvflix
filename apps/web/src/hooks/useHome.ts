import { useState, useEffect } from 'react'
import { fetchHome } from '../lib/api.js'
import type { HomeResponse } from '@iptvflix/api-contracts'

export type UseHomeResult = {
  data: HomeResponse | undefined
  isLoading: boolean
  error: Error | null
}

export function useHome(profileId: string): UseHomeResult {
  const [data, setData] = useState<HomeResponse | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchHome(profileId)
      .then((result) => {
        if (!cancelled) {
          setData(result)
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
  }, [profileId])

  return { data, isLoading, error }
}
