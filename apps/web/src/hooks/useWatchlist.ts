import { useState, useEffect, useCallback } from 'react'
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '../lib/api.js'
import { useProfile } from '../context/ProfileContext.js'
import { useInteractionEvents } from './useInteractionEvents.js'
import type { WatchlistEntry, WatchlistMediaType } from '@iptvflix/api-contracts'

export type UseWatchlistResult = {
  entries: WatchlistEntry[]
  loading: boolean
  add: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>
  remove: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>
}

export function useWatchlist(): UseWatchlistResult {
  const { profileVersion } = useProfile()
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { emit: emitEvent } = useInteractionEvents()

  useEffect(() => {
    setEntries([])
    setLoading(true)
    fetchWatchlist()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profileVersion])

  const add = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
    const optimistic: WatchlistEntry = {
      id: `optimistic-${mediaId}`,
      profileId: '',
      mediaType,
      mediaId,
      title: mediaId,
      posterUrl: null,
      addedAt: new Date().toISOString(),
    }
    setEntries((prev) => [optimistic, ...prev])
    try {
      const created = await addToWatchlist({ mediaType, mediaId })
      setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? created : e)))
      emitEvent({ eventType: 'MY_LIST_ADDED', mediaType, mediaId, clientType: 'web' })
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== optimistic.id))
    }
  }, [emitEvent])

  const remove = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
    setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)))
    try {
      await removeFromWatchlist(mediaType, mediaId)
      emitEvent({ eventType: 'MY_LIST_REMOVED', mediaType, mediaId, clientType: 'web' })
    } catch {
      fetchWatchlist().then(setEntries).catch(() => {})
    }
  }, [emitEvent])

  return { entries, loading, add, remove }
}
