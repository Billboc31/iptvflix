import { useCallback, useEffect, useState } from 'react'
import type { AvailabilityVariantResponse, DeliveryMode } from '@iptvflix/api-contracts'
import { resolvePlayback, ApiError } from '../lib/api.js'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export type UsePlaybackState = {
  gatewayUrl: string | null
  deliveryMode: DeliveryMode | null
  containerExtension: string | null
  startPositionSeconds: number
  alternatives: AvailabilityVariantResponse[]
  availabilityId: string | null
  probeDurationSeconds: number | null
  status: Status
  error: string | null
  switchVariant: (id: string) => void
  restartPlayback: () => void
}

export function usePlayback(
  mediaType: 'movie' | 'episode',
  mediaId: string,
  initialAvailabilityId?: string,
): UsePlaybackState {
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null)
  const [containerExtension, setContainerExtension] = useState<string | null>(null)
  const [startPositionSeconds, setStartPositionSeconds] = useState(0)
  const [alternatives, setAlternatives] = useState<AvailabilityVariantResponse[]>([])
  const [availabilityId, setAvailabilityId] = useState<string | null>(initialAvailabilityId ?? null)
  const [probeDurationSeconds, setProbeDurationSeconds] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(
    async (explicitId?: string, restart = false) => {
      setStatus('loading')
      setError(null)
      try {
        const session = await resolvePlayback(
          mediaType,
          mediaId,
          {
            ...(explicitId ? { availabilityId: explicitId } : {}),
            ...(restart ? { restart: true } : {}),
          },
        )
        setGatewayUrl(session.gatewayUrl)
        setDeliveryMode(session.deliveryMode)
        setContainerExtension(session.containerExtension)
        setStartPositionSeconds(session.startPositionSeconds)
        setAlternatives(session.alternatives)
        setAvailabilityId(session.availabilityId)
        setProbeDurationSeconds(session.probeResult?.durationSeconds ?? null)
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

  const restartPlayback = useCallback(() => {
    resolve(availabilityId ?? undefined, true)
  }, [resolve, availabilityId])

  return { gatewayUrl, deliveryMode, containerExtension, startPositionSeconds, alternatives, availabilityId, probeDurationSeconds, status, error, switchVariant, restartPlayback }
}
