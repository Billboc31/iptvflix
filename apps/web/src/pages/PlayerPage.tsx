import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { usePlayback } from '../hooks/usePlayback.js'
import { useProgressSync } from '../hooks/useProgressSync.js'
import { useEpisodeNavigation } from '../hooks/useEpisodeNavigation.js'
import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
import PlayerControls from '../components/player/PlayerControls.js'
import type { AudioTrack, SubtitleTrack } from '../components/player/PlayerControls.js'
import ErrorState from '../components/ui/ErrorState.js'
import { getStoredAuthToken } from '../lib/api.js'
import { updateProfilePreferences } from '../lib/api.js'
import { resolveMediaUrl } from '../lib/media-url.js'
import { isHlsContainer, isMpegTsContainer, videoErrorMessage } from '../lib/player-errors.js'
import { formatTime } from '../lib/format-time.js'
import { getLanguageName } from '../lib/language-names.js'

// Resume dialog thresholds
const RESUME_THRESHOLD_START_S = 30
const RESUME_THRESHOLD_END_S = 60

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
  const hlsRef = useRef<import('hls.js').default | null>(null)

  // Diagnostic: event sequence log reset on each load()
  const eventLogRef = useRef<Array<{ event: string; t: number }>>([])

  const initialAvailabilityId = searchParams.get('availabilityId') ?? undefined
  const seriesId = searchParams.get('seriesId') ?? null
  const seasonNumber = searchParams.get('seasonNumber') ? Number(searchParams.get('seasonNumber')) : null
  const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode'

  const [videoError, setVideoError] = useState<string | null>(null)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  // HLS.js audio/subtitle state
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number | null>(null)

  const { gatewayUrl, deliveryMode, containerExtension, startPositionSeconds, alternatives, availabilityId, probeDurationSeconds, status, error, switchVariant } = usePlayback(
    resolvedMediaType as 'movie' | 'episode',
    mediaId!,
    initialAvailabilityId,
  )

  // stableDurationSeconds: set from probe on session resolve, then updated via onStableDuration
  // callback when PlayerControls discovers the duration from the video element.
  const [stableDurationSeconds, setStableDurationSeconds] = useState<number | null>(null)
  const stableDurationRef = useRef<number | null>(null)
  stableDurationRef.current = stableDurationSeconds

  const startPositionRef = useRef<number>(0)
  startPositionRef.current = startPositionSeconds

  useEffect(() => {
    if (status === 'loading') {
      setStableDurationSeconds(null)
    } else if (status === 'ready') {
      setStableDurationSeconds(probeDurationSeconds)
    }
  }, [status, probeDurationSeconds])

  const handleStableDuration = useCallback((seconds: number) => {
    setStableDurationSeconds(seconds)
  }, [])

  const progressMediaType: ProgressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'
  const interactionMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'

  // Track viewing session and first-play state per media load (declared early for useProgressSync)
  const sessionIdRef = useRef<string | null>(null)
  const hasPlayedRef = useRef(false)

  const { flushProgress } = useProgressSync(videoRef, progressMediaType, mediaId!, status === 'ready', stableDurationSeconds, sessionIdRef.current)
  const { emit: emitEvent, emitBatch } = useInteractionEvents()

  // Reset play tracking when media changes
  useEffect(() => {
    sessionIdRef.current = null
    hasPlayedRef.current = false
  }, [mediaId])

  // Emit PLAY_STARTED on first play, PLAY_RESUMED on subsequent plays
  useEffect(() => {
    if (status !== 'ready') return
    const video = videoRef.current
    if (!video) return

    function onPlay() {
      if (!mediaId) return
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true
        emitBatch([{
          eventType: 'PLAY_STARTED',
          mediaType: interactionMediaType,
          mediaId,
          episodeId: resolvedMediaType === 'episode' ? mediaId : null,
          seriesId: seriesId ?? null,
          positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
          durationMs: stableDurationRef.current ? Math.floor(stableDurationRef.current * 1000) : null,
          availabilityId: availabilityId ?? null,
          clientType: 'web',
        }]).then((res) => {
          if (res.sessionId) sessionIdRef.current = res.sessionId
        }).catch(() => undefined)
      } else {
        emitEvent({
          eventType: 'PLAY_RESUMED',
          mediaType: interactionMediaType,
          mediaId,
          sessionId: sessionIdRef.current ?? undefined,
          positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
          clientType: 'web',
        })
      }
    }

    function onPause() {
      if (!mediaId || video?.ended) return
      emitEvent({
        eventType: 'PLAY_PAUSED',
        mediaType: interactionMediaType,
        mediaId,
        sessionId: sessionIdRef.current ?? undefined,
        positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
        clientType: 'web',
      })
    }

    function onEnded() {
      if (!mediaId) return
      emitEvent({
        eventType: 'PLAY_COMPLETED',
        mediaType: interactionMediaType,
        mediaId,
        sessionId: sessionIdRef.current ?? undefined,
        positionMs: Math.floor((video?.currentTime ?? 0) * 1000),
        durationMs: stableDurationRef.current ? Math.floor(stableDurationRef.current * 1000) : null,
        clientType: 'web',
      })
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mediaId])

  // Emit PLAY_ABANDONED on unmount if player was active
  useEffect(() => {
    return () => {
      const video = videoRef.current
      if (!video || !mediaId || !hasPlayedRef.current || video.ended) return
      const progress = stableDurationRef.current && stableDurationRef.current > 0
        ? video.currentTime / stableDurationRef.current
        : 0
      if (progress >= 0.05) {
        emitEvent({
          eventType: 'PLAY_ABANDONED',
          mediaType: interactionMediaType,
          mediaId,
          sessionId: sessionIdRef.current ?? undefined,
          positionMs: Math.floor(video.currentTime * 1000),
          clientType: 'web',
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  // Episode navigation
  const { episodeLabel, nextEpisode } = useEpisodeNavigation(
    resolvedMediaType === 'episode' ? (mediaId ?? null) : null,
    seriesId,
    seasonNumber,
  )

  function handleNextEpisode() {
    if (!nextEpisode) return
    emitEvent({
      eventType: 'NEXT_EPISODE_MANUAL',
      mediaType: interactionMediaType,
      mediaId: mediaId ?? undefined,
      sessionId: sessionIdRef.current ?? undefined,
      clientType: 'web',
    })
    flushProgress()
    const params = new URLSearchParams()
    if (nextEpisode.selectedVariantId) params.set('availabilityId', nextEpisode.selectedVariantId)
    if (seriesId) params.set('seriesId', seriesId)
    if (seasonNumber != null) params.set('seasonNumber', String(seasonNumber))
    const qs = params.toString()
    navigate(`/player/episode/${nextEpisode.id}${qs ? `?${qs}` : ''}`)
  }

  const handleVariantSwitch = useCallback((id: string) => {
    emitEvent({
      eventType: 'SOURCE_SELECTED',
      mediaType: interactionMediaType,
      mediaId: mediaId ?? undefined,
      sessionId: sessionIdRef.current ?? undefined,
      availabilityId: id,
      clientType: 'web',
    })
    flushProgress()
    switchVariant(id)
  }, [flushProgress, switchVariant, mediaId, interactionMediaType, emitEvent])

  // Audio track change handler
  function handleAudioTrack(id: number) {
    const hls = hlsRef.current
    if (hls) hls.audioTrack = id
    setCurrentAudioTrack(id)
    const track = audioTracks.find((t) => t.id === id)
    emitEvent({
      eventType: 'AUDIO_TRACK_SELECTED',
      mediaType: interactionMediaType,
      mediaId: mediaId ?? undefined,
      sessionId: sessionIdRef.current ?? undefined,
      metadataJson: track ? { lang: track.lang } : null,
      clientType: 'web',
    })
    if (track?.lang) {
      updateProfilePreferences({ preferredAudioLanguages: [track.lang] }).catch(() => undefined)
    }
  }

  // Subtitle track change handler
  function handleSubtitleTrack(id: number | null) {
    const hls = hlsRef.current
    if (hls) {
      hls.subtitleTrack = id ?? -1
      hls.subtitleDisplay = id !== null
    }
    setCurrentSubtitleTrack(id)
    const track = id !== null ? subtitleTracks.find((t) => t.id === id) : null
    emitEvent({
      eventType: 'SUBTITLE_TRACK_SELECTED',
      mediaType: interactionMediaType,
      mediaId: mediaId ?? undefined,
      sessionId: sessionIdRef.current ?? undefined,
      metadataJson: track ? { lang: track.lang } : { disabled: true },
      clientType: 'web',
    })
    if (id !== null && track?.lang) {
      updateProfilePreferences({ preferredSubtitleLanguages: [track.lang] }).catch(() => undefined)
    }
  }

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
    setShowResumeDialog(false)
    setAudioTracks([])
    setCurrentAudioTrack(0)
    setSubtitleTracks([])
    setCurrentSubtitleTrack(null)
    hlsRef.current = null

    const mediaUrl = resolveMediaUrl(gatewayUrl)
    const authToken = getStoredAuthToken()
    const isHls = deliveryMode !== 'DIRECT' || isHlsContainer(containerExtension)

    async function attach() {
      if (isHls) {
        try {
          const { default: Hls } = await import('hls.js')
          if (cancelled) return
          if (Hls.isSupported()) {
            hlsInstance = new Hls({
              enableWorker: true,
              maxBufferLength: 60,
              maxMaxBufferLength: 180,
              lowLatencyMode: false,
              progressive: true,
              xhrSetup(xhr, requestUrl) {
                const apiBase = import.meta.env.VITE_API_BASE ?? ''
                let sameOrigin = !apiBase
                try {
                  sameOrigin = new URL(requestUrl, apiBase || window.location.origin).origin === new URL(apiBase || window.location.origin).origin
                } catch {
                  sameOrigin = requestUrl.includes('/playback/')
                }
                if (!sameOrigin) {
                  xhr.withCredentials = false
                  return
                }
                xhr.withCredentials = true
                if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
              },
            })

            hlsRef.current = hlsInstance

            hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal || cancelled) return
              const status = typeof data.response?.code === 'number' ? data.response.code : undefined
              if (status) httpStatusRef.current = status
              setVideoError(videoErrorMessage(video, status))
            })

            // Audio track management
            hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
              if (cancelled || !hlsInstance) return
              setAudioTracks(
                hlsInstance.audioTracks.map((t) => ({
                  id: t.id,
                  label: getLanguageName(t.lang || t.name),
                  lang: t.lang ?? '',
                })),
              )
              setCurrentAudioTrack(hlsInstance.audioTrack)
            })
            hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => {
              if (!cancelled) setCurrentAudioTrack(data.id)
            })

            // Subtitle track management
            hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
              if (cancelled || !hlsInstance) return
              setSubtitleTracks(
                hlsInstance.subtitleTracks.map((t) => ({
                  id: t.id,
                  label: t.name ?? getLanguageName(t.lang),
                  lang: t.lang ?? '',
                })),
              )
            })
            hlsInstance.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_e, data) => {
              if (!cancelled) setCurrentSubtitleTrack(data.id < 0 ? null : data.id)
            })

            hlsInstance.loadSource(mediaUrl)
            hlsInstance.attachMedia(video)
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              if (startPositionRef.current <= RESUME_THRESHOLD_START_S) {
                void video.play().catch(() => {
                  video.muted = true
                  void video.play()
                })
              }
            })
            return
          }
        } catch {
          // fall through to native HLS (Safari)
        }
        if (!cancelled && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = mediaUrl
          if (startPositionRef.current <= RESUME_THRESHOLD_START_S) {
            void video.play().catch(() => {
              video.muted = true
              void video.play()
            })
          }
        }
        return
      }

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
            if (startPositionRef.current <= RESUME_THRESHOLD_START_S) {
              void mpegtsPlayer.play()
            }
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
      if (startPositionRef.current <= RESUME_THRESHOLD_START_S) {
        void video.play().catch(() => {
          video.muted = true
          void video.play()
        })
      }
    }

    void attach()

    return () => {
      cancelled = true
      hlsRef.current = null
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

  // Resume dialog and seek-to-saved-position on metadata ready
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    function onMetadata() {
      if (!video) return
      // Prefer probe-based stable duration; fall back to what the video element reports
      const dur = stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0)
      if (
        startPositionSeconds > RESUME_THRESHOLD_START_S &&
        isFinite(dur) && dur > 0 &&
        startPositionSeconds < dur - RESUME_THRESHOLD_END_S
      ) {
        video.pause()
        setShowResumeDialog(true)
      } else {
        if (startPositionSeconds > 0) {
          video.currentTime = startPositionSeconds
        }
        void video.play()?.catch(() => undefined)
      }
    }
    video.addEventListener('loadedmetadata', onMetadata)
    return () => video.removeEventListener('loadedmetadata', onMetadata)
  }, [startPositionSeconds])

  function handleResumeConfirm() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = startPositionSeconds
    void video.play()?.catch(() => undefined)
    setShowResumeDialog(false)
  }

  function handleRestart() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    void video.play()?.catch(() => undefined)
    setShowResumeDialog(false)
  }

  useEffect(() => {
    if (!showResumeDialog) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowResumeDialog(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showResumeDialog])

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
        playsInline
        muted
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

      {/* Resume dialog */}
      {showResumeDialog && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-dialog-title"
            aria-describedby="resume-dialog-desc"
            className="bg-[#1a1a24] border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4 text-center"
          >
            <h2 id="resume-dialog-title" className="text-white text-base font-medium mb-2">
              {resolvedMediaType === 'episode' && episodeLabel ? episodeLabel : 'Reprendre la lecture ?'}
            </h2>
            <p id="resume-dialog-desc" className="text-white/70 text-sm mb-5">
              Vous vous êtes arrêté à {formatTime(startPositionSeconds)}.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleResumeConfirm}
                autoFocus
                aria-label={`Reprendre à ${formatTime(startPositionSeconds)}`}
                className="px-5 py-2 bg-white text-black text-sm font-semibold rounded hover:bg-white/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Reprendre à {formatTime(startPositionSeconds)}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="px-5 py-2 bg-white/10 text-white text-sm font-medium rounded hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {resolvedMediaType === 'episode' ? "Recommencer l'épisode" : 'Recommencer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom controls overlay — only when URL is loaded */}
      {!videoError && (status === 'ready' || status === 'idle') && (
        <PlayerControls
          videoRef={videoRef}
          alternatives={alternatives}
          onVariantSwitch={handleVariantSwitch}
          onClose={handleBack}
          currentVariantId={availabilityId}
          audioTracks={audioTracks}
          currentAudioTrack={currentAudioTrack}
          onAudioTrack={handleAudioTrack}
          subtitleTracks={subtitleTracks}
          currentSubtitleTrack={currentSubtitleTrack}
          onSubtitleTrack={handleSubtitleTrack}
          episodeLabel={episodeLabel}
          nextEpisode={nextEpisode}
          onNextEpisode={handleNextEpisode}
          markers={[]}
          deliveryMode={deliveryMode}
          containerExtension={containerExtension}
          hintDurationSeconds={stableDurationSeconds}
          onStableDuration={handleStableDuration}
        />
      )}
    </div>
  )
}
