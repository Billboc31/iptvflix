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
  if (httpStatus === 410) return 'Session de lecture expirée'
  if (video?.error) {
    const code = video.error.code
    if (code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return 'Impossible de lire ce contenu sur ce navigateur'
    }
  }
  return 'Erreur de lecture'
}

// Named map for MediaError codes (Safari Web Inspector visibility)
const MEDIA_ERROR_NAMES: Record<number, string> = {
  1: 'MEDIA_ERR_ABORTED',
  2: 'MEDIA_ERR_NETWORK',
  3: 'MEDIA_ERR_DECODE',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
}

// Named map for readyState values
const READY_STATE_NAMES: Record<number, string> = {
  0: 'HAVE_NOTHING',
  1: 'HAVE_METADATA',
  2: 'HAVE_CURRENT_DATA',
  3: 'HAVE_FUTURE_DATA',
  4: 'HAVE_ENOUGH_DATA',
}

// Named map for networkState values
const NETWORK_STATE_NAMES: Record<number, string> = {
  0: 'NETWORK_EMPTY',
  1: 'NETWORK_IDLE',
  2: 'NETWORK_LOADING',
  3: 'NETWORK_NO_SOURCE',
}

export default function PlayerPage() {
  const { mediaType, mediaId } = useParams<{ mediaType: string; mediaId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const httpStatusRef = useRef<number | undefined>(undefined)

  // Diagnostic: event sequence log reset on each load()
  const eventLogRef = useRef<Array<{ event: string; t: number }>>([])

  const initialAvailabilityId = searchParams.get('availabilityId') ?? undefined
  const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode'

  const [videoError, setVideoError] = useState<string | null>(null)

  const { gatewayUrl, deliveryMode, containerExtension, startPositionSeconds, alternatives, status, error, switchVariant } = usePlayback(
    resolvedMediaType as 'movie' | 'episode',
    mediaId!,
    initialAvailabilityId,
  )

  const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'

  useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready')

  // Load stream into video element when gateway URL is ready.
  // Backend guarantees the URL is browser-compatible based on probe result;
  // no client-side compat fallback is needed.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !gatewayUrl || !deliveryMode) return

    let hlsInstance: import('hls.js').default | null = null
    let cancelled = false

    httpStatusRef.current = undefined
    eventLogRef.current = []
    setVideoError(null)

    // HLS delivery (backend-generated pipeline or provider-native HLS with DIRECT+m3u8)
    const isHls = deliveryMode !== 'DIRECT' ||
      containerExtension === 'm3u8' ||
      containerExtension === 'm3u'

    if (isHls) {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (Hls.isSupported()) {
          hlsInstance = new Hls()
          hlsInstance.loadSource(gatewayUrl)
          hlsInstance.attachMedia(video)
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari / iOS native HLS
          video.src = gatewayUrl
        }
      }).catch(() => {
        if (!cancelled && video) video.src = gatewayUrl
      })
    } else {
      // DIRECT MP4 — native browser video element
      video.src = gatewayUrl
    }

    return () => {
      cancelled = true
      hlsInstance?.destroy()
      video.src = ''
    }
  }, [gatewayUrl, deliveryMode, containerExtension])

  // Diagnostic: track video events for browser DevTools correlation
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const TRACKED_EVENTS = ['loadstart', 'loadedmetadata', 'canplay', 'stalled', 'waiting', 'error'] as const

    function recordEvent(name: string) {
      eventLogRef.current.push({ event: name, t: Date.now() })
    }

    const handlers = TRACKED_EVENTS.map((name) => {
      const handler = () => recordEvent(name)
      video.addEventListener(name, handler)
      return { name, handler }
    })

    return () => {
      handlers.forEach(({ name, handler }) => video.removeEventListener(name, handler))
    }
  }, [gatewayUrl])

  // Detect gateway HTTP error codes via HEAD probe on video error
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
      const errorCode = videoRef.current?.error?.code

      console.warn('[iptvflix:player] video error event', {
        errorCode,
        errorCodeName: errorCode != null ? (MEDIA_ERROR_NAMES[errorCode] ?? `unknown(${errorCode})`) : null,
        errorMessage: videoRef.current?.error?.message ?? null,
        readyState: videoRef.current?.readyState,
        readyStateName: videoRef.current?.readyState != null ? (READY_STATE_NAMES[videoRef.current.readyState] ?? null) : null,
        networkState: videoRef.current?.networkState,
        networkStateName: videoRef.current?.networkState != null ? (NETWORK_STATE_NAMES[videoRef.current.networkState] ?? null) : null,
        deliveryMode,
        eventSequence: eventLogRef.current.map((e) => `${e.event}+${e.t - (eventLogRef.current[0]?.t ?? e.t)}ms`),
      })

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
  }, [gatewayUrl, deliveryMode])

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
          <ErrorState
            message={videoError}
            onRetry={() => {
              eventLogRef.current = []
              setVideoError(null)
              const video = videoRef.current
              if (video && gatewayUrl) {
                video.src = gatewayUrl
                video.load()
                video.play().catch(() => {})
              }
            }}
          />
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
