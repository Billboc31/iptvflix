import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ContinueWatchingItem, ProgressMediaType } from '@iptvflix/api-contracts'
import ContinueWatchingOverflowMenu from './ContinueWatchingOverflowMenu.js'

type Props = {
  item: ContinueWatchingItem
  onDismiss: (mediaType: ProgressMediaType, mediaId: string) => Promise<void>
  dismissError?: string | null
}

export default function ContinueWatchingCard({ item, onDismiss, dismissError }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  const pct = item.durationSeconds > 0
    ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
    : 0

  const mediaTypeLower = item.mediaType === 'MOVIE' ? 'movie' : 'episode'
  const playerUrl = `/player/${mediaTypeLower}/${item.mediaId}?source=continue_watching`

  function handlePlay() {
    navigate(playerUrl)
  }

  function handleDetails() {
    setMenuOpen(false)
    if (item.mediaType === 'MOVIE') {
      navigate(`/movies/${item.mediaId}`, { state: { background: location, scrollY: window.scrollY } })
    } else if (item.seriesId) {
      navigate(`/series/${item.seriesId}`, { state: { background: location, scrollY: window.scrollY } })
    }
  }

  async function handleDismiss() {
    setMenuOpen(false)
    try {
      await onDismiss(item.mediaType, item.mediaId)
    } catch {
      // error is surfaced via dismissError prop from useContinueWatching hook
    }
  }

  const episodeLabel =
    item.mediaType === 'EPISODE' && item.seasonNumber != null && item.episodeNumber != null
      ? `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` · ${item.episodeTitle}` : ''}`
      : null

  return (
    <div className="relative flex-shrink-0 w-36">
      {/* Poster area with interactive overlay */}
      <div className="relative aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <span className="text-4xl select-none">🎬</span>
            <span className="text-xs text-center px-2 line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Central play button — full-card click target */}
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Reprendre"
          className="absolute inset-0 flex items-center justify-center group/play"
        >
          <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover/play:bg-white/35 transition-colors">
            <svg
              className="w-6 h-6 text-white translate-x-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>

        {/* Episode label at bottom of poster */}
        {episodeLabel && (
          <div className="absolute bottom-1 left-0 right-0 px-2 pointer-events-none">
            <p className="text-white text-[10px] font-medium line-clamp-1 drop-shadow">{episodeLabel}</p>
          </div>
        )}
      </div>

      {/* Below-poster section */}
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-xs font-medium line-clamp-1">{item.title}</p>

        {/* Progress bar + action buttons on same row */}
        <div className="mt-1 flex items-center gap-1">
          <div
            className="flex-1 h-1 bg-gray-700 rounded-full"
            aria-label={`${pct}% visionné`}
          >
            <div
              className="h-full bg-[#e50914] rounded-full"
              style={{ width: `${pct}%` }}
              data-testid="progress-bar"
            />
          </div>

          {/* Info button */}
          <button
            type="button"
            onClick={handleDetails}
            aria-label="Voir les détails"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M12 11v5" />
            </svg>
          </button>

          {/* Overflow button */}
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Plus d'options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
        </div>

        {dismissError && (
          <p className="text-red-400 text-[10px] mt-0.5">{dismissError}</p>
        )}
      </div>

      {/* Overflow menu — positioned relative to card */}
      {menuOpen && (
        <ContinueWatchingOverflowMenu
          onClose={() => {
            setMenuOpen(false)
            menuTriggerRef.current?.focus()
          }}
          onDetails={handleDetails}
          onDismiss={handleDismiss}
          triggerRef={menuTriggerRef}
        />
      )}
    </div>
  )
}
