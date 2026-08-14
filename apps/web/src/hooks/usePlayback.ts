import { useCallback, useEffect, useState } from 'react'
import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts'
import { resolvePlayback, ApiError } from '../lib/api.js'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export type UsePlaybackState = {
  gatewayUrl: string | null
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
  availabilityId: string | null
  status: Status
  error: string | null
  switchVariant: (id: string) => void
}

export function usePlayback(
  mediaType: 'movie' | 'episode',
  mediaId: string,
  initialAvailabilityId?: string,
): UsePlaybackState {
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)
  const [startPositionSeconds, setStartPositionSeconds] = useState(0)
  const [alternatives, setAlternatives] = useState<AvailabilityVariantResponse[]>([])
  const [availabilityId, setAvailabilityId] = useState<string | null>(initialAvailabilityId ?? null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(
    async (explicitId?: string) => {
      setStatus('loading')
      setError(null)
      try {
        const session = await resolvePlayback(
          mediaType,
          mediaId,
          explicitId ? { availabilityId: explicitId } : {},
        )
        setGatewayUrl(session.gatewayUrl)
        setStartPositionSeconds(session.startPositionSeconds)
        setAlternatives(session.alternatives)
        setAvailabilityId(session.availabilityId)
        setStatus('ready')
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Impossible de démarrer la lecture.'
        setError(message)
        setStatus('error')
      }
    },
    [mediaType, mediaId],
  )

  useEffect(() => {
    resolve(initialAvailabilityId)
  }, [resolve, initialAvailabilityId])

  const switchVariant = useCallback(
    (id: string) => {
      resolve(id)
    },
    [resolve],
  )

  return { gatewayUrl, startPositionSeconds, alternatives, availabilityId, status, error, switchVariant }
}
