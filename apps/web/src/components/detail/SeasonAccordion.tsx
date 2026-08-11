import { useState } from 'react'
import type { SeasonSummary, EpisodeResponse } from '@iptvflix/api-contracts'
import { getSeriesSeasonEpisodes } from '../../lib/api.js'
import Spinner from '../ui/Spinner.js'
import EpisodeRow from './EpisodeRow.js'

type Props = {
  seriesId: string
  seasons: SeasonSummary[]
}

export default function SeasonAccordion({ seriesId, seasons }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [episodeCache, setEpisodeCache] = useState<Map<number, EpisodeResponse[]>>(new Map())
  const [loading, setLoading] = useState<Set<number>>(new Set())

  if (seasons.length === 0) {
    return (
      <p className="text-gray-400 text-sm">Les saisons ne sont pas encore disponibles.</p>
    )
  }

  async function toggle(seasonNumber: number) {
    const nextExpanded = new Set(expanded)
    if (nextExpanded.has(seasonNumber)) {
      nextExpanded.delete(seasonNumber)
      setExpanded(nextExpanded)
      return
    }
    nextExpanded.add(seasonNumber)
    setExpanded(nextExpanded)

    if (episodeCache.has(seasonNumber)) return

    setLoading((prev) => new Set([...prev, seasonNumber]))
    try {
      const eps = await getSeriesSeasonEpisodes(seriesId, seasonNumber)
      setEpisodeCache((prev) => new Map([...prev, [seasonNumber, eps]]))
    } finally {
      setLoading((prev) => {
        const next = new Set(prev)
        next.delete(seasonNumber)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {seasons.map((season) => {
        const isExpanded = expanded.has(season.seasonNumber)
        const isLoading = loading.has(season.seasonNumber)
        const eps = episodeCache.get(season.seasonNumber)

        return (
          <div
            key={season.seasonNumber}
            className="bg-[#1a1a24] border border-white/5 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(season.seasonNumber)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
              aria-expanded={isExpanded}
            >
              <span className="text-gray-200 text-sm font-medium">
                Saison {season.seasonNumber}
                {season.title ? ` — ${season.title}` : ''}
              </span>
              <span className="flex items-center gap-3 text-gray-500 text-xs flex-shrink-0 ml-4">
                {season.episodeCount > 0 && (
                  <span>{season.episodeCount} épisode{season.episodeCount > 1 ? 's' : ''}</span>
                )}
                {season.airYear && <span>{season.airYear}</span>}
                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-white/5 px-4">
                {isLoading ? (
                  <div className="py-4 flex justify-center">
                    <Spinner />
                  </div>
                ) : eps && eps.length > 0 ? (
                  eps.map((ep) => <EpisodeRow key={ep.id} episode={ep} />)
                ) : (
                  <p className="py-4 text-gray-500 text-sm">Aucun épisode disponible.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
