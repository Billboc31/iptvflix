import { useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { usePlayback } from '../hooks/usePlayback.js'
import { useProgressSync } from '../hooks/useProgressSync.js'
import Button from '../components/ui/Button.js'
import ErrorState from '../components/ui/ErrorState.js'

export default function PlayerPage() {
  const { mediaType, mediaId } = useParams<{ mediaType: string; mediaId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  const initialAvailabilityId = searchParams.get('availabilityId') ?? undefined
  const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode'

  const { streamUrl, startPositionSeconds, alternatives, status, error, switchVariant } = usePlayback(
    resolvedMediaType as 'movie' | 'episode',
    mediaId!,
    initialAvailabilityId,
  )

  const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'

  useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready')

  // Load stream into video element when URL is ready
  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    if (streamUrl.includes('.m3u8')) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls()
          hls.loadSource(streamUrl)
          hls.attachMedia(video)
          // cleanup returned to caller below
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl
        }
      }).catch(() => {
        if (video) video.src = streamUrl
      })
    } else {
      video.src = streamUrl
    }

    return () => {
      video.src = ''
    }
  }, [streamUrl])

  // Set resume position on metadata ready
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    function onMetadata() {
      if (video && startPositionSeconds > 0) {
        video.currentTime = startPositionSeconds
      }
    }
    video.addEventListener('loadedmetadata', onMetadata)
    return () => video.removeEventListener('loadedmetadata', onMetadata)
  }, [startPositionSeconds])

  function handleBack() {
    videoRef.current?.pause()
    navigate(-1)
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <ErrorState
          message={error ?? 'Impossible de lancer la lecture.'}
          onRetry={() => navigate(-1)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← Retour
        </Button>
      </div>

      {/* Loading spinner */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
      />

      {/* Variant selector */}
      {alternatives.length > 0 && (
        <div className="absolute bottom-20 right-4 z-10 bg-black/80 rounded-lg p-3 max-w-xs">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Autres versions</p>
          <div className="flex flex-col gap-1">
            {alternatives.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => switchVariant(v.id)}
                className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/10 text-left transition-colors"
              >
                {[v.audioLanguage?.toUpperCase(), v.videoQuality]
                  .filter(Boolean)
                  .join(' · ') || 'Version alternative'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
