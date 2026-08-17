import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { upsertProgress, getStoredAuthToken } from '../lib/api.js'

const DEBOUNCE_MS = 10_000
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export function useProgressSync(
  videoRef: RefObject<HTMLVideoElement | null>,
  mediaType: ProgressMediaType,
  mediaId: string,
  enabled: boolean,
  stableDurationSeconds: number | null,
): { flushProgress: () => void } {
  const lastSentRef = useRef<number>(0)
  const mediaTypeRef = useRef(mediaType)
  const mediaIdRef = useRef(mediaId)
  mediaTypeRef.current = mediaType
  mediaIdRef.current = mediaId

  const stableDurationRef = useRef<number | null>(stableDurationSeconds)
  stableDurationRef.current = stableDurationSeconds

  const flushProgress = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const effectiveDuration = stableDurationRef.current ?? Math.floor(video.duration)
    if (!effectiveDuration || !isFinite(effectiveDuration)) return
    lastSentRef.current = Date.now()
    upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
      progressSeconds: Math.floor(video.currentTime),
      durationSeconds: effectiveDuration,
    }).catch(() => undefined)
  }, [videoRef])

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return

    function sendProgress() {
      if (!video) return
      const effectiveDuration = stableDurationRef.current ?? Math.floor(video.duration)
      if (!effectiveDuration || !isFinite(effectiveDuration)) return
      const now = Date.now()
      if (now - lastSentRef.current < DEBOUNCE_MS) return
      lastSentRef.current = now
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds: Math.floor(video.currentTime),
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function sendFinal() {
      if (!video) return
      const effectiveDuration = stableDurationRef.current ?? Math.floor(video.duration)
      if (!effectiveDuration || !isFinite(effectiveDuration)) return
      lastSentRef.current = Date.now()
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds: effectiveDuration,
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function onPause() {
      if (!video) return
      const effectiveDuration = stableDurationRef.current ?? Math.floor(video.duration)
      if (!effectiveDuration || !isFinite(effectiveDuration)) return
      lastSentRef.current = Date.now()
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds: Math.floor(video.currentTime),
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function onBeforeUnload() {
      const v = videoRef.current
      if (!v) return
      const effectiveDuration = stableDurationRef.current ?? Math.floor(v.duration)
      if (!effectiveDuration || !isFinite(effectiveDuration)) return
      const token = getStoredAuthToken()
      // fetch with keepalive survives page close and supports auth headers
      fetch(`${API_BASE}/progress/${mediaTypeRef.current}/${mediaIdRef.current}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          progressSeconds: Math.floor(v.currentTime),
          durationSeconds: effectiveDuration,
        }),
        keepalive: true,
      }).catch(() => undefined)
    }

    video.addEventListener('timeupdate', sendProgress)
    video.addEventListener('ended', sendFinal)
    video.addEventListener('pause', onPause)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      video.removeEventListener('timeupdate', sendProgress)
      video.removeEventListener('ended', sendFinal)
      video.removeEventListener('pause', onPause)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [videoRef, enabled])

  return { flushProgress }
}
