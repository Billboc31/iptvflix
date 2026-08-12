import { useState, useCallback } from 'react'
import { generateShelf } from '../lib/api.js'
import type { GenerateShelfBody, GenerateShelfResponse } from '@iptvflix/api-contracts'

export type UseGenerateShelfResult = {
  generate: (body: GenerateShelfBody) => Promise<GenerateShelfResponse>
  loading: boolean
  error: Error | null
}

export function useGenerateShelf(): UseGenerateShelfResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async (body: GenerateShelfBody): Promise<GenerateShelfResponse> => {
    setLoading(true)
    setError(null)
    try {
      return await generateShelf(body)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { generate, loading, error }
}
