import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ChannelResponse, ChannelHistoryEntry } from '@iptvflix/api-contracts'
import {
  listChannels,
  addFavorite,
  removeFavorite,
  listHistory,
  recordHistory as apiRecordHistory,
} from '../lib/api.js'
import { useProfile } from './ProfileContext.js'
import { preferredCountryFromLanguages } from '../lib/countries.js'

export type CatalogMode = 'curated' | 'all'

type ChannelsContextValue = {
  channels: ChannelResponse[]
  isLoading: boolean
  error: string | null
  catalog: CatalogMode
  country: string
  setCatalog: (mode: CatalogMode) => void
  setCountry: (country: string) => void
  favoriteIds: Set<string>
  toggleFavorite: (channelId: string) => Promise<void>
  history: ChannelHistoryEntry[]
  recordHistory: (channelId: string) => void
}

const ChannelsContext = createContext<ChannelsContextValue | null>(null)

export function ChannelsProvider({ children }: { children: React.ReactNode }) {
  const { currentProfile } = useProfile()
  const preferredCountry = preferredCountryFromLanguages(currentProfile?.preferredAudioLanguages)

  const [channels, setChannels] = useState<ChannelResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogMode>('curated')
  const [country, setCountry] = useState(preferredCountry)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<ChannelHistoryEntry[]>([])

  useEffect(() => {
    setCountry(preferredCountry)
  }, [preferredCountry])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    listChannels(
      catalog === 'curated'
        ? { catalog: 'curated', country }
        : { catalog: 'all' },
    )
      .then((data) => {
        if (cancelled) return
        setChannels(data)
        const favs = new Set(data.filter((c) => c.isFavorite).map((c) => c.id))
        setFavoriteIds(favs)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les chaînes.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [catalog, country])

  useEffect(() => {
    listHistory()
      .then(setHistory)
      .catch(() => {/* history is optional — fail silently */})
  }, [])

  const toggleFavorite = useCallback(async (channelId: string) => {
    const wasFav = favoriteIds.has(channelId)
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (wasFav) next.delete(channelId)
      else next.add(channelId)
      return next
    })
    try {
      if (wasFav) await removeFavorite(channelId)
      else await addFavorite(channelId)
    } catch {
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
    <ChannelsContext.Provider
      value={{
        channels,
        isLoading,
        error,
        catalog,
        country,
        setCatalog,
        setCountry,
        favoriteIds,
        toggleFavorite,
        history,
        recordHistory,
      }}
    >
      {children}
    </ChannelsContext.Provider>
  )
}

export function useChannels(): ChannelsContextValue {
  const ctx = useContext(ChannelsContext)
  if (!ctx) throw new Error('useChannels must be used within ChannelsProvider')
  return ctx
}
