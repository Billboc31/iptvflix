import { useState, useEffect } from 'react'
import type { EpisodeResponse } from '@iptvflix/api-contracts'
import { getSeriesSeasonEpisodes } from '../lib/api.js'

type EpisodeNav = {
  episodeLabel: string | null
  nextEpisode: EpisodeResponse | null
  previousEpisode: EpisodeResponse | null
}

export function useEpisodeNavigation(
  mediaId: string | null,
  seriesId: string | null,
  seasonNumber: number | null,
): EpisodeNav {
  const [episodes, setEpisodes] = useState<EpisodeResponse[]>([])

  useEffect(() => {
    if (!seriesId || seasonNumber === null) return
    let cancelled = false
    getSeriesSeasonEpisodes(seriesId, seasonNumber)
      .then((eps) => {
        if (!cancelled) setEpisodes(eps)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [seriesId, seasonNumber])

  if (!mediaId || episodes.length === 0) {
    return { episodeLabel: null, nextEpisode: null, previousEpisode: null }
  }

  const idx = episodes.findIndex((e) => e.id === mediaId)
  if (idx === -1) {
    return { episodeLabel: null, nextEpisode: null, previousEpisode: null }
  }

  const current = episodes[idx]
  const episodeLabel = `E${current.episodeNumber}${current.title ? ` · ${current.title}` : ''}`
  const nextEpisode = idx < episodes.length - 1 ? (episodes[idx + 1] ?? null) : null
  const previousEpisode = idx > 0 ? (episodes[idx - 1] ?? null) : null

  return { episodeLabel, nextEpisode, previousEpisode }
}
