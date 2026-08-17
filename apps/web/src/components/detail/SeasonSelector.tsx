import { useState, useEffect } from 'react'
import type { SeasonSummary, EpisodeResponse, DeviceResponse } from '@iptvflix/api-contracts'
import { getSeriesSeasonEpisodes } from '../../lib/api.js'
import Spinner from '../ui/Spinner.js'
import EpisodeCard from './EpisodeCard.js'

type Props = {
  seriesId: string
  seasons: SeasonSummary[]
  profileId?: string
  devices?: DeviceResponse[]
  progressByEpisodeId?: Record<string, number>
}

export default function SeasonSelector({ seriesId, seasons, profileId, devices, progressByEpisodeId }: Props) {
  const [selectedSeason, setSelectedSeason] = useState<number>(
    seasons.length > 0 ? seasons[0].seasonNumber : 0,
  )
  const [episodeCache, setEpisodeCache] = useState<Map<number, EpisodeResponse[]>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (seasons.length === 0) return
    if (!seasons.some((s) => s.seasonNumber === selectedSeason)) {
      setSelectedSeason(seasons[0].seasonNumber)
    }
  }, [seasons, selectedSeason])

  useEffect(() => {
    if (seasons.length === 0) return
    if (episodeCache.has(selectedSeason) && (episodeCache.get(selectedSeason)?.length ?? 0) > 0) return
    let cancelled = false
    setLoading(true)

    async function loadEpisodes() {
      for (let i = 0; i < 10; i++) {
        try {
          const eps = await getSeriesSeasonEpisodes(seriesId, selectedSeason, profileId)
          if (cancelled) return
          if (eps.length > 0) {
            setEpisodeCache((prev) => new Map([...prev, [selectedSeason, eps]]))
            setLoading(false)
            return
          }
        } catch {
          /* retry while TMDB hydration is still running */
        }
        await new Promise((r) => setTimeout(r, 2000))
        if (cancelled) return
      }
      if (!cancelled) {
        setEpisodeCache((prev) => new Map([...prev, [selectedSeason, []]]))
        setLoading(false)
      }
    }

    void loadEpisodes()
    return () => {
      cancelled = true
    }
  }, [seriesId, selectedSeason, profileId, seasons.length])

  if (seasons.length === 0) {
    return <p className="text-gray-400 text-sm">Chargement des saisons…</p>
  }

  const episodes = episodeCache.get(selectedSeason)

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="season-select" className="sr-only">Saison</label>
        <select
          id="season-select"
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(Number(e.target.value))}
          className="bg-[#1a1a24] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e50914] cursor-pointer"
        >
          {seasons.map((s) => (
            <option key={s.seasonNumber} value={s.seasonNumber}>
              {s.title ?? `Saison ${s.seasonNumber}`}
              {s.airYear ? ` (${s.airYear})` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : episodes && episodes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {episodes.map((ep) => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              devices={devices}
              progressMs={progressByEpisodeId?.[ep.id] ?? 0}
              seriesId={seriesId}
              seasonNumber={selectedSeason}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm py-4">Aucun épisode disponible.</p>
      )}
    </div>
  )
}
