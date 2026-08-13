import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button.js'
import PreviewPlayer from './PreviewPlayer.js'
import { usePreview } from '../../contexts/PreviewContext.js'

function isPointerCoarse() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
}

type HeroSectionProps = {
  title: string
  synopsis?: string | null
  backdropUrl?: string | null
  mediaId?: string
  trailerKey?: string | null
  onDetails?: () => void
  onAddToList?: () => void
}

export default function HeroSection({
  title,
  synopsis,
  backdropUrl,
  mediaId,
  trailerKey,
  onDetails,
  onAddToList,
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
    if (!mediaId || !trailerKey || isPointerCoarse()) return
    timerRef.current = setTimeout(() => activate(mediaId, trailerKey), 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (isActiveRef.current) deactivate()
    }
  }, [mediaId, trailerKey, activate, deactivate])

  return (
    <div className="relative h-[56vh] min-h-80 overflow-hidden">
      {/* Backdrop */}
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
      )}

      {/* Preview player — mounts only when active */}
      {trailerKey && (
        <PreviewPlayer trailerKey={trailerKey} active={isActive} muted={muted} />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />

      {/* Mute/unmute control — visible only during active preview */}
      {isActive && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors border border-white/20"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? 'Son coupé' : 'Son activé'}
        </button>
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-8 pb-10 max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">{title}</h1>
        {synopsis && (
          <p className="text-gray-300 text-sm leading-relaxed mb-6 line-clamp-3">{synopsis}</p>
        )}
        <div className="flex gap-3">
          {onDetails && <Button onClick={onDetails}>Détails</Button>}
          {onAddToList && (
            <Button variant="secondary" onClick={onAddToList}>
              + Ma Liste
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
