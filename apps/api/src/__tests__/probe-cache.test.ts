import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProbe, setProbe } from '../services/probe-cache.js'
import type { MediaInfo } from '../services/media-prober.js'

const TTL_MS = 24 * 60 * 60 * 1000

const sampleInfo: MediaInfo = { videoCodec: 'h264', audioCodec: 'aac', containerFormat: 'mp4' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('probe-cache', () => {
  it('returns null for an unknown availabilityId', () => {
    expect(getProbe('does-not-exist')).toBeNull()
  })

  it('returns the cached MediaInfo on a cache hit', () => {
    const id = 'cache-hit-test'
    setProbe(id, sampleInfo)
    expect(getProbe(id)).toEqual(sampleInfo)
  })

  it('returns the same object reference (no copy)', () => {
    const id = 'cache-ref-test'
    setProbe(id, sampleInfo)
    expect(getProbe(id)).toBe(sampleInfo)
  })

  it('does not expire before the 24-hour TTL', () => {
    const id = 'cache-not-expired'
    setProbe(id, sampleInfo)
    vi.advanceTimersByTime(TTL_MS - 1)
    expect(getProbe(id)).toEqual(sampleInfo)
  })

  it('expires the entry after the 24-hour TTL', () => {
    const id = 'cache-expired'
    setProbe(id, sampleInfo)
    vi.advanceTimersByTime(TTL_MS + 1)
    expect(getProbe(id)).toBeNull()
  })

  it('overwrites a stale entry with setProbe', () => {
    const id = 'cache-overwrite'
    const firstInfo: MediaInfo = { videoCodec: 'hevc', audioCodec: 'ac3', containerFormat: 'mpegts' }
    setProbe(id, firstInfo)
    vi.advanceTimersByTime(TTL_MS + 1)

    setProbe(id, sampleInfo)
    expect(getProbe(id)).toEqual(sampleInfo)
  })

  it('independent entries do not interfere with each other', () => {
    const idA = 'cache-independent-a'
    const idB = 'cache-independent-b'
    const infoA: MediaInfo = { videoCodec: 'h264', audioCodec: 'aac', containerFormat: 'mp4' }
    const infoB: MediaInfo = { videoCodec: 'vp9', audioCodec: 'opus', containerFormat: 'webm' }
    setProbe(idA, infoA)
    setProbe(idB, infoB)
    expect(getProbe(idA)).toEqual(infoA)
    expect(getProbe(idB)).toEqual(infoB)
  })
})
