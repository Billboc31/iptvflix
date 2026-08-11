import { useState, useEffect, useCallback } from 'react'
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '../lib/api.js'
import type { WatchlistEntry, WatchlistMediaType } from '@iptvflix/api-contracts'

export type UseWatchlistResult = {
  entries: WatchlistEntry[]
  loading: boolean
  add: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>
  remove: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>
}

export function useWatchlist(): UseWatchlistResult {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWatchlist()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== optimistic.id))
    }
  }, [])

  const remove = useCallback(async (mediaType: WatchlistMediaType, mediaId: string) => {
    // Optimistic remove; re-fetch on error to restore correct state
    setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)))
    try {
      await removeFromWatchlist(mediaType, mediaId)
    } catch {
      fetchWatchlist().then(setEntries).catch(() => {})
    }
  }, [])

  return { entries, loading, add, remove }
}
