import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useProgressSync } from './useProgressSync.js'

vi.mock('../lib/api.js', () => ({
  upsertProgress: vi.fn().mockResolvedValue({}),
  getStoredAuthToken: vi.fn().mockReturnValue('test-token'),
}))

import { upsertProgress } from '../lib/api.js'

function makeVideo(currentTime = 100, duration = 3600) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    configurable: true,
  })
  Object.defineProperty(video, 'duration', {
    get: () => duration,
    configurable: true,
  })
  return video
}

describe('useProgressSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes immediately on pause event', () => {
    const video = makeVideo(100, 3600)
    const videoRef = { current: video }

    renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', true))

    act(() => {
      video.dispatchEvent(new Event('pause'))
    })

    expect(upsertProgress).toHaveBeenCalledWith('MOVIE', 'movie-1', {
      progressSeconds: 100,
      durationSeconds: 3600,
    })
  })

  it('debounces timeupdate events — only sends once within 10 seconds', () => {
    vi.useFakeTimers()
    const video = makeVideo(50, 3600)
    const videoRef = { current: video }

    renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', true))

    act(() => {
      video.dispatchEvent(new Event('timeupdate'))
      video.dispatchEvent(new Event('timeupdate'))
      video.dispatchEvent(new Event('timeupdate'))
    })

    // Only the first timeupdate sends (others within debounce window)
    expect(upsertProgress).toHaveBeenCalledTimes(1)
  })

  it('sends final progress on ended event with duration as position', () => {
    const video = makeVideo(100, 3600)
    const videoRef = { current: video }

    renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', true))

    act(() => {
      video.dispatchEvent(new Event('ended'))
    })

    expect(upsertProgress).toHaveBeenCalledWith('MOVIE', 'movie-1', {
      progressSeconds: 3600,
      durationSeconds: 3600,
    })
  })

  it('flushProgress callback sends progress immediately', () => {
    const video = makeVideo(200, 3600)
    const videoRef = { current: video }

    const { result } = renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', true))

    act(() => {
      result.current.flushProgress()
    })

    expect(upsertProgress).toHaveBeenCalledWith('MOVIE', 'movie-1', {
      progressSeconds: 200,
      durationSeconds: 3600,
    })
  })

  it('does not send when disabled', () => {
    const video = makeVideo(100, 3600)
    const videoRef = { current: video }

    renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', false))

    act(() => {
      video.dispatchEvent(new Event('pause'))
      video.dispatchEvent(new Event('timeupdate'))
    })

    expect(upsertProgress).not.toHaveBeenCalled()
  })

  it('does not send when duration is 0', () => {
    const video = makeVideo(0, 0)
    const videoRef = { current: video }

    renderHook(() => useProgressSync(videoRef, 'MOVIE', 'movie-1', true))

    act(() => {
      video.dispatchEvent(new Event('pause'))
    })

    expect(upsertProgress).not.toHaveBeenCalled()
  })
})
