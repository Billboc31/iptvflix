import { useState, useEffect, useCallback } from 'react'
import { fetchFeedback, setFeedback, clearFeedback } from '../lib/api.js'
import { useInteractionEvents } from './useInteractionEvents.js'
import type { FeedbackItem, FeedbackType, WatchlistMediaType } from '@iptvflix/api-contracts'

export type UseFeedbackResult = {
  entries: FeedbackItem[]
  loading: boolean
  set: (mediaType: WatchlistMediaType, mediaId: string, feedback: FeedbackType) => Promise<void>
  clear: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>
  get: (mediaType: WatchlistMediaType, mediaId: string) => FeedbackItem | undefined
}

export function useFeedback(): UseFeedbackResult {
  const [entries, setEntries] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const { emit: emitEvent } = useInteractionEvents()

  useEffect(() => {
    fetchFeedback()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = useCallback(async (mediaType: WatchlistMediaType, mediaId: string, feedback: FeedbackType) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId))
      return [{ mediaType, mediaId, feedback, updatedAt: new Date().toISOString() }, ...filtered]
    })
    try {
      const updated = await setFeedback(mediaType, mediaId, { feedback })
      setEntries((prev) => prev.map((e) => (e.mediaType === mediaType && e.mediaId === mediaId ? updated : e)))
      if (feedback === 'LIKE') {
        emitEvent({ eventType: 'LIKED', mediaType, mediaId, clientType: 'web' })
      } else if (feedback === 'DISLIKE') {
        emitEvent({ eventType: 'DISLIKED', mediaType, mediaId, clientType: 'web' })
      }
    } catch {
      fetchFeedback().then(setEntries).catch(() => {})
    }
  }, [emitEvent])

  const clear = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
    setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)))
    try {
      await clearFeedback(mediaType, mediaId)
    } catch {
      fetchFeedback().then(setEntries).catch(() => {})
    }
  }, [])

  const get = useCallback(
    (mediaType: WatchlistMediaType, mediaId: string) =>
      entries.find((e) => e.mediaType === mediaType && e.mediaId === mediaId),
    [entries],
  )

  return { entries, loading, set, clear, get }
}
