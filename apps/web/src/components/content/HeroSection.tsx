import { useEffect, useRef, useState } from 'react'
import type { AvailabilityStatus } from '@iptvflix/api-contracts'
import Button from '../ui/Button.js'
import PreviewPlayer from './PreviewPlayer.js'
import { usePreview } from '../../contexts/PreviewContext.js'

type HeroSectionProps = {
  title: string
  synopsis?: string | null
  backdropUrl?: string | null
  posterUrl?: string | null
  mediaId?: string
  trailerKey?: string | null
  availabilityStatus?: AvailabilityStatus
  onPlay?: () => void
  onDetails?: () => void
}

export default function HeroSection({
  title,
  synopsis,
  backdropUrl,
  posterUrl,
  mediaId,
  trailerKey,
  availabilityStatus,
  onPlay,
  onDetails,
}: HeroSectionProps) {
  const { activeId, activate, deactivate } = usePreview()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActive = !!mediaId && activeId === mediaId
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    setMuted(true)
  }, [mediaId])

  useEffect(() => {
    if (!mediaId || !trailerKey) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timerRef.current = setTimeout(() => activate(mediaId, trailerKey), 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (isActiveRef.current) deactivate()
    }
  }, [mediaId, trailerKey, activate, deactivate])

  return (
    <div role="region" aria-label="Contenu vedette" className="relative h-[60vh] md:h-[85vh] min-h-80 overflow-hidden">
      {/* Backdrop — desktop */}
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="hidden md:block absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
      )}

      {/* Artwork — mobile (poster preferred, falls back to backdrop) */}
      {(posterUrl || backdropUrl) ? (
        <img
          src={posterUrl ?? backdropUrl!}
          alt=""
          aria-hidden="true"
          className="md:hidden absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div className="md:hidden absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
      )}

      {/* Preview player — mounts only when active */}
      {trailerKey && (
        <PreviewPlayer trailerKey={trailerKey} active={isActive} muted={muted} />
      )}

      {/* Top gradient — blends with nav */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0a0f]/60 via-transparent to-transparent" />

      {/* Left gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />

      {/* Bottom gradient — stronger for shelf blend */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />

      {/* Mute/unmute control — visible only during active preview */}
      {isActive && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 transition-colors border border-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-4 md:px-8 pb-6 md:pb-10 max-w-2xl">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 drop-shadow-lg">{title}</h1>
        {synopsis && (
          <p className="text-gray-300 text-sm leading-relaxed mb-6 line-clamp-2 md:line-clamp-3">{synopsis}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {availabilityStatus === 'AVAILABLE' && onPlay && (
            <Button
              onClick={onPlay}
              className="focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              Lire
            </Button>
          )}
          {onDetails && (
            <Button
              variant="secondary"
              onClick={onDetails}
              className="focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              Plus d'infos
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
