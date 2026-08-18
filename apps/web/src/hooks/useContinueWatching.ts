import { useState, useEffect } from 'react'
import { fetchContinueWatching, dismissContinueWatching } from '../lib/api.js'
import { useProfile } from '../context/ProfileContext.js'
import type { ContinueWatchingItem, ProgressMediaType } from '@iptvflix/api-contracts'

export type UseContinueWatchingResult = {
  items: ContinueWatchingItem[]
  loading: boolean
  error: Error | null
  dismissItem: (mediaType: ProgressMediaType, mediaId: string) => Promise<void>
  dismissError: string | null
  dismissErrorFor: string | null
}

export function useContinueWatching(): UseContinueWatchingResult {
  const { profileVersion } = useProfile()
  const [items, setItems] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dismissError, setDismissError] = useState<string | null>(null)
  const [dismissErrorFor, setDismissErrorFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchContinueWatching()
      .then((next) => {
        if (!cancelled) setItems(next)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileVersion])

  async function dismissItem(mediaType: ProgressMediaType, mediaId: string): Promise<void> {
    setDismissError(null)
    setDismissErrorFor(null)
    const previous = items
    setItems((current) => current.filter((i) => !(i.mediaType === mediaType && i.mediaId === mediaId)))
    try {
      await dismissContinueWatching(mediaType, mediaId)
    } catch {
      setItems(previous)
      setDismissError('Erreur lors de la suppression')
      setDismissErrorFor(mediaId)
    }
  }

  return { items, loading, error, dismissItem, dismissError, dismissErrorFor }
}
