import { randomUUID } from 'node:crypto'
import type { DeliveryMode } from './playback-compat.js'

const TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

export type SessionEntry = {
  sessionId: string
  profileId: string
  mediaType: 'movie' | 'episode' | 'channel'
  mediaId: string
  availabilityId: string
  sourceId: string
  providerStreamUrl: string
  containerExtension: string
  deliveryMode: DeliveryMode
  correlationId: string
}

type StoredEntry = SessionEntry & { expiresAt: number }

const sessions = new Map<string, StoredEntry>()

function pruneExpired(): void {
  const now = Date.now()
  for (const [id, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(id)
  }
}

export function createSession(data: Omit<SessionEntry, 'sessionId'>): string {
  pruneExpired()
  const sessionId = randomUUID()
  sessions.set(sessionId, { ...data, sessionId, expiresAt: Date.now() + TTL_MS })
  return sessionId
}

export function getSession(sessionId: string): SessionEntry | null {
  const entry = sessions.get(sessionId)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return null
  }
  const { expiresAt, ...rest } = entry
  return rest
}

export function patchSession(
  sessionId: string,
  patch: Partial<Pick<SessionEntry, 'deliveryMode' | 'providerStreamUrl'>>,
): void {
  const entry = sessions.get(sessionId)
  if (!entry) return
  if (patch.deliveryMode) entry.deliveryMode = patch.deliveryMode
  if (patch.providerStreamUrl) entry.providerStreamUrl = patch.providerStreamUrl
}

export function findSessionByAvailabilityId(availabilityId: string): SessionEntry | null {
  pruneExpired()
  const now = Date.now()
  for (const [, entry] of sessions) {
    if (entry.availabilityId === availabilityId && entry.expiresAt > now) {
      const { expiresAt, ...rest } = entry
      return rest
    }
  }
  return null
}
