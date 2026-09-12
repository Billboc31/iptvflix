import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNeverStop } from './useNeverStop.js'
import { coversEnd } from '../lib/skip-policy.js'
const intro = { type: 'INTRO' as const, startMs: 10000, endMs: 90000, autoSkipSafe: true }
function video() {
  const v = document.createElement('video')
  Object.defineProperties(v, { paused: { value: false, configurable: true }, duration: { value: 1440 }, seekable: { value: { length: 1, start: () => 0, end: () => 1440 } } })
  return v
}
describe('Never Stop playback', () => {
  it('does not skip before the segment and skips once inside', () => {
    const v = video(); const next = vi.fn(() => true)
    renderHook(() => useNeverStop({ current: v }, [intro], { neverStopMode: true }, true, 0, 'ep', next))
    act(() => { v.currentTime = 5; v.dispatchEvent(new Event('timeupdate')) })
    expect(v.currentTime).toBe(5)
    act(() => { v.currentTime = 11; v.dispatchEvent(new Event('timeupdate')) })
    expect(v.currentTime).toBe(90)
    act(() => { v.currentTime = 12; v.dispatchEvent(new Event('timeupdate')) })
    expect(v.currentTime).toBe(12)
    expect(next).not.toHaveBeenCalled()
  })
  it('does not skip paused playback or unverified timestamps', () => {
    const v = video(); Object.defineProperty(v, 'paused', { value: true })
    renderHook(() => useNeverStop({ current: v }, [intro], { neverStopMode: true }, true, 0, 'ep', () => false))
    act(() => { v.currentTime = 20; v.dispatchEvent(new Event('timeupdate')) })
    expect(v.currentTime).toBe(20)
  })
  it('uses absolute metadata on a local remux timeline', () => {
    const v = video()
    renderHook(() => useNeverStop({ current: v }, [{ ...intro, startMs: 50000 }], { neverStopMode: true }, true, 40, 'ep', () => false))
    act(() => { v.currentTime = 11; v.dispatchEvent(new Event('timeupdate')) })
    expect(v.currentTime).toBe(50)
  })
  it('preserves a scene after the credits', () => {
    const ending = { type: 'CREDITS' as const, startMs: 1200000, endMs: 1380000, autoSkipSafe: true }
    expect(coversEnd(ending, [ending], 1440000)).toBe(false)
    expect(coversEnd({ ...ending, endMs: 1440000 }, [], 1440000)).toBe(true)
  })
  it('continues normally without timestamps and autoplay only advances on ended', () => {
    const v = video(); const next = vi.fn(() => true)
    renderHook(() => useNeverStop({ current: v }, [], { autoplayNextEpisode: true }, true, 0, 'ep', next))
    act(() => v.dispatchEvent(new Event('timeupdate')))
    expect(next).not.toHaveBeenCalled()
    act(() => v.dispatchEvent(new Event('ended')))
    expect(next).toHaveBeenCalledOnce()
  })
})
