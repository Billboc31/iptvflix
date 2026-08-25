import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ChannelResponse, ChannelHistoryEntry } from '@iptvflix/api-contracts'
import {
  listChannels,
  addFavorite,
  removeFavorite,
  listHistory,
  recordHistory as apiRecordHistory,
} from '../lib/api.js'

type ChannelsContextValue = {
  channels: ChannelResponse[]
  isLoading: boolean
  error: string | null
  favoriteIds: Set<string>
  toggleFavorite: (channelId: string) => Promise<void>
  history: ChannelHistoryEntry[]
  recordHistory: (channelId: string) => void
}

const ChannelsContext = createContext<ChannelsContextValue | null>(null)

export function ChannelsProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<ChannelResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<ChannelHistoryEntry[]>([])

  useEffect(() => {
    listChannels()
      .then((data) => {
        setChannels(data)
        const favs = new Set(data.filter((c) => c.isFavorite).map((c) => c.id))
        setFavoriteIds(favs)
      })
      .catch(() => setError('Impossible de charger les chaînes.'))
      .finally(() => setIsLoading(false))

    listHistory()
      .then(setHistory)
      .catch(() => {/* history is optional — fail silently */})
  }, [])

  const toggleFavorite = useCallback(async (channelId: string) => {
    const wasFav = favoriteIds.has(channelId)
    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (wasFav) next.delete(channelId)
      else next.add(channelId)
      return next
    })
    try {
      if (wasFav) {
        await removeFavorite(channelId)
      } else {
        await addFavorite(channelId)
      }
    } catch {
      // Roll back on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFav) next.add(channelId)
        else next.delete(channelId)
        return next
      })
    }
  }, [favoriteIds])

  const recordHistory = useCallback((channelId: string) => {
    void apiRecordHistory(channelId)
    const channel = channels.find((c) => c.id === channelId)
    if (!channel) return
    const entry: ChannelHistoryEntry = {
      channelId,
      name: channel.name,
      logoUrl: channel.logoUrl,
      watchedAt: new Date().toISOString(),
    }
    setHistory((prev) => [entry, ...prev.filter((h) => h.channelId !== channelId)].slice(0, 20))
  }, [channels])

  return (
    <ChannelsContext.Provider value={{ channels, isLoading, error, favoriteIds, toggleFavorite, history, recordHistory }}>
      {children}
    </ChannelsContext.Provider>
  )
}

export function useChannels(): ChannelsContextValue {
  const ctx = useContext(ChannelsContext)
  if (!ctx) throw new Error('useChannels must be used within ChannelsProvider')
  return ctx
}
