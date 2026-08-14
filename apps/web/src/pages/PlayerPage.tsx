import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { usePlayback } from '../hooks/usePlayback.js'
import { useProgressSync } from '../hooks/useProgressSync.js'
import PlayerControls from '../components/player/PlayerControls.js'
import ErrorState from '../components/ui/ErrorState.js'

function videoErrorMessage(video: HTMLVideoElement | null, httpStatus?: number): string {
  if (httpStatus === 401 || httpStatus === 403) return 'Source expirée — contactez l\'administrateur'
  if (httpStatus === 404) return 'Média introuvable chez le fournisseur'
  if (httpStatus === 504) return 'Fournisseur ne répond pas'
  if (httpStatus === 415) return 'Format non supporté par votre navigateur'
  if (video?.error) {
    const code = video.error.code
    if (code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return 'Erreur de décodage vidéo'
    }
  }
  return 'Erreur de lecture'
}

export default function PlayerPage() {
  const { mediaType, mediaId } = useParams<{ mediaType: string; mediaId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const httpStatusRef = useRef<number | undefined>(undefined)

  const initialAvailabilityId = searchParams.get('availabilityId') ?? undefined
  const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode'

  const [videoError, setVideoError] = useState<string | null>(null)

  const { gatewayUrl, containerExtension, startPositionSeconds, alternatives, status, error, switchVariant } = usePlayback(
    resolvedMediaType as 'movie' | 'episode',
    mediaId!,
    initialAvailabilityId,
  )

  const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'

  useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready')

  // Load stream into video element when gateway URL is ready
  useEffect(() => {
    const video = videoRef.current
    if (!video || !gatewayUrl) return

    let hlsInstance: import('hls.js').default | null = null
    let cancelled = false

    httpStatusRef.current = undefined
    setVideoError(null)

    const ext = containerExtension?.toLowerCase()
    if (ext === 'm3u8' || ext === 'm3u') {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (Hls.isSupported()) {
          hlsInstance = new Hls()
          hlsInstance.loadSource(gatewayUrl)
          hlsInstance.attachMedia(video)
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = gatewayUrl
        }
      }).catch(() => {
        if (!cancelled && video) video.src = gatewayUrl
      })
    } else {
      video.src = gatewayUrl
    }

    return () => {
      cancelled = true
      hlsInstance?.destroy()
      video.src = ''
    }
  }, [gatewayUrl, containerExtension])

  // Detect gateway HTTP error codes via HEAD or fetch-error event
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    async function checkGatewayStatus() {
      if (!gatewayUrl) return
      try {
        const res = await fetch(gatewayUrl, { method: 'HEAD' })
        if (!res.ok) httpStatusRef.current = res.status
      } catch {
        // ignore
      }
    }

    function onError() {
      if (!httpStatusRef.current) {
        checkGatewayStatus()
          .then(() => setVideoError(videoErrorMessage(videoRef.current, httpStatusRef.current)))
          .catch(() => setVideoError(videoErrorMessage(videoRef.current, undefined)))
      } else {
        setVideoError(videoErrorMessage(videoRef.current, httpStatusRef.current))
      }
    }

    video.addEventListener('error', onError)
    return () => video.removeEventListener('error', onError)
  }, [gatewayUrl])

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
    const message = error ?? 'Aucune version disponible'
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <ErrorState
          message={message}
          onRetry={() => navigate(-1)}
        />
      </div>
    )
  }

  return (
    <div className="player-container fixed inset-0 bg-black">
      {/* Resolve loading spinner */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Video element — no native controls */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
      />

      {/* Stream-level error overlay — gateway/decode failures after resolve */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ErrorState message={videoError} onRetry={handleBack} />
        </div>
      )}

      {/* Custom controls overlay — only when URL is loaded */}
      {!videoError && (status === 'ready' || status === 'idle') && (
        <PlayerControls
          videoRef={videoRef}
          alternatives={alternatives}
          onVariantSwitch={switchVariant}
          onClose={handleBack}
        />
      )}
    </div>
  )
}
