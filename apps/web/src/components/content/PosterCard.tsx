import { useEffect, useRef } from 'react'
import Badge from '../ui/Badge.js'
import PreviewPlayer from './PreviewPlayer.js'
import { usePreview } from '../../contexts/PreviewContext.js'

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

type PosterCardProps = {
  title: string
  year?: number | null
  posterUrl?: string | null
  quality?: string | null
  badge?: { label: string; variant: 'unavailable' | 'upcoming' }
  mediaId?: string
  trailerKey?: string | null
  onClick?: () => void
}

export default function PosterCard({
  title,
  year,
  posterUrl,
  quality,
  badge,
  mediaId,
  trailerKey,
  onClick,
}: PosterCardProps) {
  const { activeId, activate, deactivate } = usePreview()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActive = !!mediaId && activeId === mediaId

  function startPreview() {
    if (!mediaId || !trailerKey || isTouch()) return
    timerRef.current = setTimeout(() => activate(mediaId, trailerKey), 1500)
  }

  function cancelPreview() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (isActive) deactivate()
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      onClick={onClick}
      onMouseEnter={startPreview}
      onMouseLeave={cancelPreview}
      onFocus={startPreview}
      onBlur={cancelPreview}
      className="relative flex-shrink-0 w-36 cursor-pointer group"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Poster image */}
      <div className="aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative">
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <span className="text-4xl select-none">🎬</span>
            <span className="text-xs text-center px-2 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Preview player — lazy-mounted only for the active card */}
        {trailerKey && <PreviewPlayer trailerKey={trailerKey} active={isActive} />}

        {/* Quality badge */}
        {quality && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="quality">{quality}</Badge>
          </div>
        )}

        {/* Availability/upcoming badge */}
        {badge && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-center">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-full">
            Détails
          </span>
        </div>
      </div>

      {/* Title + year */}
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{title}</p>
        {year && <p className="text-gray-500 text-xs mt-0.5">{year}</p>}
      </div>
    </div>
  )
}
