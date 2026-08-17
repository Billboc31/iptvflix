import { useEffect, useRef, useState, useCallback } from 'react'
import type { RefObject } from 'react'
import type { AvailabilityVariantResponse, EpisodeResponse } from '@iptvflix/api-contracts'
import { formatTime } from '../../lib/format-time.js'
import { getLanguageName } from '../../lib/language-names.js'
import { usePlayerKeyboard } from '../../hooks/usePlayerKeyboard.js'

export type AudioTrack = { id: number; label: string; lang: string }
export type SubtitleTrack = { id: number; label: string; lang: string }
export type Marker = { type: 'intro' | 'recap' | 'outro'; startSeconds: number; endSeconds: number }

type Popover = 'audio' | 'subtitle' | 'speed' | 'quality' | null

const NEAR_END_THRESHOLD_S = 90
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

// Augmented video types for iOS Safari fullscreen
interface WebkitHTMLVideoElement extends HTMLVideoElement {
  webkitSupportsFullscreen?: boolean
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
}

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  alternatives: AvailabilityVariantResponse[]
  onVariantSwitch: (id: string) => void
  onClose: () => void
  currentVariantId?: string | null
  // Audio tracks (from HLS.js)
  audioTracks?: AudioTrack[]
  currentAudioTrack?: number
  onAudioTrack?: (id: number) => void
  // Subtitle tracks
  subtitleTracks?: SubtitleTrack[]
  currentSubtitleTrack?: number | null
  onSubtitleTrack?: (id: number | null) => void
  // Episode navigation
  episodeLabel?: string | null
  nextEpisode?: EpisodeResponse | null
  onNextEpisode?: () => void
  // Markers (intro/recap/outro)
  markers?: Marker[]
  // Delivery mode (for embedded subtitle detection)
  deliveryMode?: string | null
}

export default function PlayerControls({
  videoRef,
  alternatives,
  onVariantSwitch,
  onClose,
  currentVariantId,
  audioTracks = [],
  currentAudioTrack = 0,
  onAudioTrack,
  subtitleTracks = [],
  currentSubtitleTrack = null,
  onSubtitleTrack,
  episodeLabel,
  nextEpisode,
  onNextEpisode,
  markers = [],
  deliveryMode,
}: Props) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [visible, setVisible] = useState(true)
  const [openPopover, setOpenPopover] = useState<Popover>(null)
  const [playbackRate, setPlaybackRate] = useState(1)

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(false)
  const scrubbingRef = useRef(false)
  const popoverOpenRef = useRef(false)

  // Sync refs with state for use in callbacks without closure staleness
  playingRef.current = playing
  popoverOpenRef.current = openPopover !== null

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  function startHideTimer() {
    clearHideTimer()
    if (!playingRef.current || scrubbingRef.current || popoverOpenRef.current) return
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000)
  }

  function showControls() {
    setVisible(true)
    startHideTimer()
  }

  // Cancel hide timer when popover opens; restart when it closes
  useEffect(() => {
    if (openPopover !== null) {
      clearHideTimer()
    } else {
      startHideTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopover])

  useEffect(() => {
    showControls()
    return clearHideTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Video element event bindings
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onPlay() {
      setPlaying(true)
      playingRef.current = true
      startHideTimer()
    }
    function onPause() {
      setPlaying(false)
      playingRef.current = false
      clearHideTimer()
      setVisible(true)
    }
    function onTimeUpdate() { setCurrentTime(video!.currentTime) }
    function onDurationChange() { setDuration(video!.duration) }
    function onVolumeChange() {
      setVolume(video!.volume)
      setMuted(video!.muted)
    }
    function onWaiting() { setBuffering(true) }
    function onPlaying() {
      setBuffering(false)
      setSeeking(false)
    }
    function onSeeking() { setSeeking(true) }
    function onSeeked() { setSeeking(false) }
    function onRateChange() { setPlaybackRate(video!.playbackRate) }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('seeking', onSeeking)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('ratechange', onRateChange)

    // Sync initial state
    setPlaying(!video.paused)
    playingRef.current = !video.paused
    setCurrentTime(video.currentTime)
    setDuration(video.duration)
    setVolume(video.volume)
    setMuted(video.muted)
    setPlaybackRate(video.playbackRate)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('ratechange', onRateChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef])

  // Fullscreen state sync (standard + iOS Safari)
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    function onWebkitFsBegin() { setIsFullscreen(true) }
    function onWebkitFsEnd() { setIsFullscreen(false) }

    document.addEventListener('fullscreenchange', onFsChange)
    const video = videoRef.current as WebkitHTMLVideoElement | null
    if (video) {
      video.addEventListener('webkitbeginfullscreen', onWebkitFsBegin)
      video.addEventListener('webkitendfullscreen', onWebkitFsEnd)
    }
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', onWebkitFsBegin)
        video.removeEventListener('webkitendfullscreen', onWebkitFsEnd)
      }
    }
  }, [videoRef])

  // Picture-in-Picture state sync
  useEffect(() => {
    function onEnterPiP() { setIsPiP(true) }
    function onLeavePiP() { setIsPiP(false) }
    const video = videoRef.current
    if (!video) return
    video.addEventListener('enterpictureinpicture', onEnterPiP)
    video.addEventListener('leavepictureinpicture', onLeavePiP)
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP)
      video.removeEventListener('leavepictureinpicture', onLeavePiP)
    }
  }, [videoRef])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => undefined)
    else video.pause()
  }, [videoRef])

  const seek = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
  }, [videoRef])

  function skip(delta: number) {
    const video = videoRef.current
    if (!video) return
    const dur = isFinite(video.duration) ? video.duration : 0
    video.currentTime = Math.max(0, Math.min(dur, video.currentTime + delta))
  }

  function changeVolume(value: number) {
    const video = videoRef.current
    if (!video) return
    video.volume = value
    video.muted = value === 0
  }

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
  }, [videoRef])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current as WebkitHTMLVideoElement | null
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
      return
    }
    const container = video.closest('.player-container') ?? document.documentElement
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => undefined)
    } else if (video.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
      // iOS Safari fallback
      video.webkitEnterFullscreen()
    }
  }, [videoRef])

  function togglePiP() {
    const video = videoRef.current
    if (!video) return
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => undefined)
    } else {
      video.requestPictureInPicture().catch(() => undefined)
    }
  }

  function setSpeed(rate: number) {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setOpenPopover(null)
  }

  function handleSeekPointerDown() {
    scrubbingRef.current = true
    clearHideTimer()
  }

  function handleSeekPointerUp() {
    scrubbingRef.current = false
    startHideTimer()
  }

  usePlayerKeyboard(videoRef, { togglePlay, seek, toggleMute, toggleFullscreen })

  const seekable = isFinite(duration) && duration > 0

  // Active marker at current time
  const activeMarker = markers.find(
    (m) => currentTime >= m.startSeconds && currentTime < m.endSeconds,
  ) ?? null

  // Near-end overlay for next episode
  const showNextEpisodeCard =
    nextEpisode != null &&
    seekable &&
    currentTime >= duration - NEAR_END_THRESHOLD_S

  // PiP support detection
  const pipSupported =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled

  // Show volume slider only on non-touch / desktop: hide on mobile where system controls volume
  // We detect via pointer coarse media query (CSS), but for rendering use a safe default of true
  // and hide via CSS class if needed
  const isMobileUA =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod/i.test(navigator.userAgent)

  function markerLabel(type: Marker['type']) {
    if (type === 'intro') return 'Passer l\'intro'
    if (type === 'recap') return 'Passer le récap'
    return 'Épisode suivant'
  }

  function variantLabel(v: AvailabilityVariantResponse) {
    const parts: string[] = []
    if (v.videoQuality) parts.push(v.videoQuality)
    if (v.audioLanguage) parts.push(getLanguageName(v.audioLanguage))
    return parts.length > 0 ? parts.join(' · ') : 'Version alternative'
  }

  function togglePopover(name: Popover) {
    setOpenPopover((prev) => (prev === name ? null : name))
  }

  return (
    <>
      {/* Buffering / seeking spinner */}
      {(buffering || seeking) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Marker button (skip intro / recap) */}
      {activeMarker && (
        <div className="absolute bottom-28 right-6 pointer-events-auto">
          <button
            type="button"
            onClick={() => seek(activeMarker.endSeconds)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded border border-white/40 backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {markerLabel(activeMarker.type)}
          </button>
        </div>
      )}

      {/* Near-end next episode card */}
      {showNextEpisodeCard && !activeMarker && (
        <div className="absolute bottom-28 right-6 pointer-events-auto">
          <button
            type="button"
            onClick={onNextEpisode}
            className="px-4 py-2 bg-[#e50914] hover:bg-[#e50914]/80 text-white text-sm font-medium rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Épisode suivant →
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onPointerMove={showControls}
        onClick={() => {
          if (openPopover !== null) { setOpenPopover(null); return }
          showControls()
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Fermer"
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="text-white text-sm font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white min-h-[44px]"
            >
              ← Retour
            </button>
            {episodeLabel && (
              <span className="text-white/80 text-sm font-medium truncate max-w-xs">{episodeLabel}</span>
            )}
          </div>

          {nextEpisode && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNextEpisode?.() }}
              className="text-white text-sm font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white min-h-[44px]"
            >
              Épisode suivant →
            </button>
          )}
        </div>

        {/* Center: play/pause target */}
        <div
          className="flex-1 flex items-center justify-center cursor-pointer"
          onClick={(e) => { e.stopPropagation(); togglePlay() }}
        >
          {!playing && !buffering && !seeking && (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white ml-1" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          className="px-4 pt-8 bg-gradient-to-t from-black/70 to-transparent"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Skip buttons row */}
          <div className="flex items-center justify-center gap-8 mb-4">
            <button
              type="button"
              aria-label="Reculer de 10 secondes"
              onClick={() => skip(-10)}
              className="text-white opacity-90 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M12.5 3a9 9 0 1 0 7.94 4.77L18.8 9.4A7 7 0 1 1 12.5 5V3z" />
                <path d="M11 3l3.5 3.5L11 10V3z" />
                <text x="8.5" y="15.5" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">10</text>
              </svg>
            </button>

            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Lire'}
              aria-pressed={playing}
              onClick={togglePlay}
              className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              aria-label="Avancer de 10 secondes"
              onClick={() => skip(10)}
              className="text-white opacity-90 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M11.5 3a9 9 0 1 1-7.94 4.77L5.2 9.4A7 7 0 1 0 11.5 5V3z" />
                <path d="M13 3l-3.5 3.5L13 10V3z" />
                <text x="8.5" y="15.5" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">10</text>
              </svg>
            </button>
          </div>

          {/* Seek bar */}
          <div className="mb-2">
            <input
              type="range"
              aria-label="Position de lecture"
              min={0}
              max={seekable ? duration : 0}
              step={1}
              value={seekable ? currentTime : 0}
              disabled={!seekable}
              onPointerDown={handleSeekPointerDown}
              onPointerUp={handleSeekPointerUp}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ touchAction: 'none' }}
              className="w-full h-1 accent-white cursor-pointer disabled:cursor-default disabled:opacity-50"
            />
          </div>

          {/* Time display */}
          <div className="text-white text-xs font-mono mb-3">
            {formatTime(currentTime)}
            {seekable ? ` / ${formatTime(duration)}` : ''}
          </div>

          {/* Bottom controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mute */}
            <button
              type="button"
              aria-label={muted ? 'Activer le son' : 'Couper le son'}
              aria-pressed={muted}
              onClick={toggleMute}
              className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {muted || volume === 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Volume slider — hidden on mobile where system controls volume */}
            {!isMobileUA && (
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onPointerDown={handleSeekPointerDown}
                onPointerUp={handleSeekPointerUp}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="w-20 h-1 accent-white cursor-pointer"
              />
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Audio track popover */}
            {audioTracks.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Piste audio"
                  aria-expanded={openPopover === 'audio'}
                  aria-haspopup="menu"
                  onClick={() => togglePopover('audio')}
                  className="text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Audio
                </button>
                {openPopover === 'audio' && (
                  <div
                    role="menu"
                    aria-label="Sélection de la piste audio"
                    className="absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[160px] py-1 z-50"
                  >
                    {audioTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { onAudioTrack?.(track.id); setOpenPopover(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      >
                        <span className="w-4 text-center">{currentAudioTrack === track.id ? '✓' : ''}</span>
                        {track.label || getLanguageName(track.lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitle track popover */}
            {(subtitleTracks.length > 0 || deliveryMode === 'DIRECT') && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Sous-titres"
                  aria-expanded={openPopover === 'subtitle'}
                  aria-haspopup="menu"
                  onClick={() => togglePopover('subtitle')}
                  className={`text-xs px-2 py-1 rounded transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${currentSubtitleTrack !== null ? 'text-white bg-white/20' : 'text-white bg-white/10 hover:bg-white/20'}`}
                >
                  CC
                </button>
                {openPopover === 'subtitle' && (
                  <div
                    role="menu"
                    aria-label="Sélection des sous-titres"
                    className="absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[180px] py-1 z-50"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onSubtitleTrack?.(null); setOpenPopover(null) }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <span className="w-4 text-center">{currentSubtitleTrack === null ? '✓' : ''}</span>
                      Désactivés
                    </button>
                    {subtitleTracks.length === 0 && deliveryMode === 'DIRECT' && (
                      <div className="px-4 py-2 text-sm text-white/50">Sous-titres non disponibles</div>
                    )}
                    {subtitleTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { onSubtitleTrack?.(track.id); setOpenPopover(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      >
                        <span className="w-4 text-center">{currentSubtitleTrack === track.id ? '✓' : ''}</span>
                        {track.label || getLanguageName(track.lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Playback speed popover */}
            <div className="relative">
              <button
                type="button"
                aria-label={`Vitesse: ${playbackRate}×`}
                aria-expanded={openPopover === 'speed'}
                aria-haspopup="menu"
                onClick={() => togglePopover('speed')}
                className="text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {playbackRate}×
              </button>
              {openPopover === 'speed' && (
                <div
                  role="menu"
                  aria-label="Vitesse de lecture"
                  className="absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[100px] py-1 z-50"
                >
                  {SPEEDS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      role="menuitem"
                      onClick={() => setSpeed(rate)}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <span className="w-4 text-center">{playbackRate === rate ? '✓' : ''}</span>
                      {rate}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality / source popover */}
            {alternatives.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Qualité"
                  aria-expanded={openPopover === 'quality'}
                  aria-haspopup="menu"
                  onClick={() => togglePopover('quality')}
                  className="text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Qualité
                </button>
                {openPopover === 'quality' && (
                  <div
                    role="menu"
                    aria-label="Sélection de la qualité"
                    className="absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[180px] py-1 z-50"
                  >
                    {alternatives.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { onVariantSwitch(v.id); setOpenPopover(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      >
                        <span className="w-4 text-center">{currentVariantId === v.id ? '✓' : ''}</span>
                        {variantLabel(v)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PiP — only when supported */}
            {pipSupported && (
              <button
                type="button"
                aria-label={isPiP ? 'Quitter le mode image dans l\'image' : 'Image dans l\'image'}
                aria-pressed={isPiP}
                onClick={togglePiP}
                className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3C1.9 3 1 3.88 1 4.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
                </svg>
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              aria-pressed={isFullscreen}
              onClick={toggleFullscreen}
              className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* WebVTT subtitle cue styling */}
      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.75);
          color: #ffffff;
          font-size: 1rem;
          line-height: 1.4;
          padding: 0.1em 0.3em;
          border-radius: 2px;
        }
      `}</style>
    </>
  )
}
