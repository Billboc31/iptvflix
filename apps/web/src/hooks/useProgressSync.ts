import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { ProgressMediaType } from '@iptvflix/api-contracts'
import { upsertProgress, getStoredAuthToken } from '../lib/api.js'
import { useInteractionEvents } from './useInteractionEvents.js'

const DEBOUNCE_MS = 10_000
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const MILESTONES = [10, 25, 50, 75, 90] as const
const COMPLETE_RATIO = 0.9
const NEAR_END_S = 60
const FLOOR_SLACK_S = 15

function resolveDuration(video: HTMLVideoElement, stableDuration: number | null): number | null {
  const videoDur = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0
  const stable = stableDuration != null && stableDuration > 0 ? Math.floor(stableDuration) : 0
  const duration = Math.max(stable, videoDur)
  if (!duration || !Number.isFinite(duration)) return null
  if (duration < Math.floor(video.currentTime)) return null
  return duration
}

function isNearEnd(currentTime: number, duration: number): boolean {
  return currentTime >= duration * COMPLETE_RATIO || currentTime >= duration - NEAR_END_S
}

export function useProgressSync(
  videoRef: RefObject<HTMLVideoElement | null>,
  mediaType: ProgressMediaType,
  mediaId: string,
  enabled: boolean,
  stableDurationSeconds: number | null,
  sessionId?: string | null,
  progressFloorSeconds = 0,
): { flushProgress: () => void } {
  const lastSentRef = useRef<number>(0)
  const mediaTypeRef = useRef(mediaType)
  const mediaIdRef = useRef(mediaId)
  mediaTypeRef.current = mediaType
  mediaIdRef.current = mediaId

  const stableDurationRef = useRef<number | null>(stableDurationSeconds)
  stableDurationRef.current = stableDurationSeconds
  const floorRef = useRef(progressFloorSeconds)
  floorRef.current = progressFloorSeconds

  function clampedProgress(video: HTMLVideoElement, duration: number): number | null {
    const progress = Math.floor(video.currentTime)
    const floor = floorRef.current
    if (floor > 0 && progress < floor - FLOOR_SLACK_S) return null
    return Math.min(Math.max(progress, 0), duration)
  }

  const { emit: emitEvent } = useInteractionEvents()
  const emittedMilestonesRef = useRef<Set<number>>(new Set())

  // Reset milestones when media changes
  useEffect(() => {
    emittedMilestonesRef.current = new Set()
  }, [mediaId])

  function checkMilestones(video: HTMLVideoElement) {
    const duration = resolveDuration(video, stableDurationRef.current)
    if (!duration || duration <= 0) return
    const percent = Math.floor((video.currentTime / duration) * 100)
    for (const threshold of MILESTONES) {
      if (percent >= threshold && !emittedMilestonesRef.current.has(threshold)) {
        emittedMilestonesRef.current.add(threshold)
        emitEvent({
          eventType: `WATCHED_${threshold}_PERCENT`,
          mediaType: mediaTypeRef.current,
          mediaId: mediaIdRef.current,
          sessionId: sessionId ?? undefined,
          progressPercent: threshold,
          positionMs: Math.floor(video.currentTime * 1000),
          clientType: 'web',
        })
      }
    }
  }

  const flushProgress = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const effectiveDuration = resolveDuration(video, stableDurationRef.current)
    if (!effectiveDuration) return
    const progressSeconds = clampedProgress(video, effectiveDuration)
    if (progressSeconds == null) return
    lastSentRef.current = Date.now()
    upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
      progressSeconds,
      durationSeconds: effectiveDuration,
    }).catch(() => undefined)
  }, [videoRef])

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return

    function sendProgress() {
      if (!video) return
      const effectiveDuration = resolveDuration(video, stableDurationRef.current)
      if (!effectiveDuration) return
      checkMilestones(video)
      const progressSeconds = clampedProgress(video, effectiveDuration)
      if (progressSeconds == null) return
      const now = Date.now()
      if (now - lastSentRef.current < DEBOUNCE_MS) return
      lastSentRef.current = now
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds,
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function sendFinal() {
      if (!video) return
      const effectiveDuration = resolveDuration(video, stableDurationRef.current)
      if (!effectiveDuration || !isNearEnd(video.currentTime, effectiveDuration)) return
      lastSentRef.current = Date.now()
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds: effectiveDuration,
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function onPause() {
      if (!video) return
      const effectiveDuration = resolveDuration(video, stableDurationRef.current)
      if (!effectiveDuration) return
      const progressSeconds = clampedProgress(video, effectiveDuration)
      if (progressSeconds == null) return
      lastSentRef.current = Date.now()
      upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
        progressSeconds,
        durationSeconds: effectiveDuration,
      }).catch(() => undefined)
    }

    function onBeforeUnload() {
      const v = videoRef.current
      if (!v) return
      const effectiveDuration = resolveDuration(v, stableDurationRef.current)
      if (!effectiveDuration) return
      const progressSeconds = clampedProgress(v, effectiveDuration)
      if (progressSeconds == null) return
      const token = getStoredAuthToken()
      // fetch with keepalive survives page close and supports auth headers
      fetch(`${API_BASE}/progress/${mediaTypeRef.current}/${mediaIdRef.current}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          progressSeconds,
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
