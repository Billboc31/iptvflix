import type { MediaInfo } from './media-prober.js'

const TTL_MS = 24 * 60 * 60 * 1000

type CacheEntry = { mediaInfo: MediaInfo; expiresAt: number }

const cache = new Map<string, CacheEntry>()

export function getProbe(availabilityId: string): MediaInfo | null {
  const entry = cache.get(availabilityId)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(availabilityId)
    return null
  }
  return entry.mediaInfo
}

export function setProbe(availabilityId: string, mediaInfo: MediaInfo): void {
  cache.set(availabilityId, { mediaInfo, expiresAt: Date.now() + TTL_MS })
}
