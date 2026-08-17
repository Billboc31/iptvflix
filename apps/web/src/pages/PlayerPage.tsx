import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { usePlayback } from '../hooks/usePlayback.js'
import { useProgressSync } from '../hooks/useProgressSync.js'
import PlayerControls from '../components/player/PlayerControls.js'
import ErrorState from '../components/ui/ErrorState.js'
import { getStoredAuthToken } from '../lib/api.js'
import { resolveMediaUrl } from '../lib/media-url.js'
import { isHlsContainer, isMpegTsContainer, videoErrorMessage } from '../lib/player-errors.js'

function playbackAuthHeaders(): HeadersInit {
  const token = getStoredAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
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

  const { gatewayUrl, deliveryMode, containerExtension, startPositionSeconds, alternatives, availabilityId, status, error, switchVariant } = usePlayback(
    resolvedMediaType as 'movie' | 'episode',
    mediaId!,
    initialAvailabilityId,
  )

  const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'

  useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready')

  // Load stream into video element when gateway URL is ready.
  useEffect(() => {
    if (!videoRef.current || !gatewayUrl || !deliveryMode) return
    const video = videoRef.current

    let hlsInstance: import('hls.js').default | null = null
    let mpegtsPlayer: {
      destroy: () => void
      attachMediaElement: (el: HTMLMediaElement) => void
      load: () => void
      play: () => Promise<void> | void
    } | null = null
    let cancelled = false

    httpStatusRef.current = undefined
    eventLogRef.current = []
    setVideoError(null)

    const mediaUrl = resolveMediaUrl(gatewayUrl)
    const authToken = getStoredAuthToken()
    const isHls = deliveryMode !== 'DIRECT' || isHlsContainer(containerExtension)

    async function probeGateway(): Promise<boolean> {
      const controller = new AbortController()
      try {
        const res = await fetch(mediaUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...playbackAuthHeaders(),
            Range: 'bytes=0-0',
          },
          signal: controller.signal,
        })
        httpStatusRef.current = res.status
        const contentType = res.headers.get('content-type') ?? ''
        controller.abort()
        if (!res.ok && res.status !== 206) {
          setVideoError(videoErrorMessage(null, res.status))
          return false
        }
        if (contentType.includes('json') || contentType.includes('text/html')) {
          setVideoError('Le fournisseur a refusé le flux')
          return false
        }
        return true
      } catch {
        if (!cancelled) setVideoError('Erreur de lecture')
        return false
      }
    }

    async function attach() {
      if (isHls) {
        try {
          const { default: Hls } = await import('hls.js')
          if (cancelled) return
          if (Hls.isSupported()) {
            hlsInstance = new Hls({
              xhrSetup(xhr) {
                xhr.withCredentials = true
                if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
              },
            })
            hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal || cancelled) return
              const status = typeof data.response?.code === 'number' ? data.response.code : undefined
              if (status) httpStatusRef.current = status
              setVideoError(videoErrorMessage(video, status))
            })
            hlsInstance.loadSource(mediaUrl)
            hlsInstance.attachMedia(video)
            return
          }
        } catch {
          // fall through to native HLS (Safari)
        }
        if (!cancelled && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = mediaUrl
        }
        return
      }

      const ok = await probeGateway()
      if (cancelled || !ok || !video) return

      if (isMpegTsContainer(containerExtension)) {
        try {
          const mpegts = (await import('mpegts.js')).default
          if (cancelled) return
          if (mpegts.isSupported()) {
            mpegtsPlayer = mpegts.createPlayer(
              {
                type: 'mpegts',
                isLive: false,
                url: mediaUrl,
                withCredentials: true,
              },
              {
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
              },
            )
            mpegtsPlayer.attachMediaElement(video)
            mpegtsPlayer.load()
            void mpegtsPlayer.play()
            return
          }
        } catch {
          // mpegts.js missing or MSE unsupported (typical on iOS)
        }
        if (!cancelled) {
          setVideoError('Ce format n\'est pas lisible sur cet appareil — essayez une autre version')
        }
        return
      }

      video.src = mediaUrl
    }

    void attach()

    return () => {
      cancelled = true
      hlsInstance?.destroy()
      mpegtsPlayer?.destroy()
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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

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

      setVideoError(videoErrorMessage(videoRef.current, httpStatusRef.current))
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
              if (availabilityId) {
                switchVariant(availabilityId)
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
