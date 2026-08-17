import { MEDIA_RELAY_SECRET, MEDIA_RELAY_URL } from '../config/env.js'

let liveRelayUrl: string | undefined
let liveRelayAt = 0

const LIVE_TTL_MS = 30 * 60 * 1000

export function setLiveMediaRelayUrl(url: string): void {
  liveRelayUrl = url.replace(/\/$/, '')
  liveRelayAt = Date.now()
}

export function getMediaRelayBaseUrl(): string | undefined {
  if (liveRelayUrl && Date.now() - liveRelayAt < LIVE_TTL_MS) {
    return liveRelayUrl
  }
  return MEDIA_RELAY_URL
}

export function isMediaRelayEnabled(): boolean {
  return Boolean(MEDIA_RELAY_SECRET && getMediaRelayBaseUrl())
}
