import { useEffect, useRef, useState } from 'react'
import Badge from '../ui/Badge.js'
import FocusedCardPortal from './FocusedCardPortal.js'
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
  const { activate, deactivate } = usePreview()
  const cardRef = useRef<HTMLDivElement>(null)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverEpoch = useRef<number>(0)
  const cardRectRef = useRef<DOMRect | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  function handleEnter() {
    if (isTouch()) return
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) cardRectRef.current = rect

    const epoch = ++hoverEpoch.current

    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    focusTimerRef.current = setTimeout(() => {
      if (hoverEpoch.current !== epoch) return
      setIsFocused(true)
    }, 400)
  }

  function handleLeave() {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current)
      focusTimerRef.current = null
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    hoverEpoch.current++
    setIsFocused(false)
    deactivate()
  }

  // Start preview timer only after card is focused
  useEffect(() => {
    if (!isFocused || !mediaId || !trailerKey) return
    const epoch = hoverEpoch.current
    previewTimerRef.current = setTimeout(() => {
      if (hoverEpoch.current !== epoch) return
      activate(mediaId, trailerKey)
    }, 1500)
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current)
        previewTimerRef.current = null
      }
    }
  }, [isFocused, mediaId, trailerKey, activate])

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className="relative w-full cursor-pointer group"
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

        {/* Hover overlay — scoped to this card's own group */}
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

      {/* Focused card portal — enlarged card rendered above the shelf */}
      {isFocused && (
        <FocusedCardPortal
          cardRect={cardRectRef.current}
          title={title}
          posterUrl={posterUrl}
          trailerKey={trailerKey}
          mediaId={mediaId}
          onDetailsClick={onClick ?? (() => {})}
        />
      )}
    </div>
  )
}
