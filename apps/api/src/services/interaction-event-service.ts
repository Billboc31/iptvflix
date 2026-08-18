import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profileInteractionEvents } from '../db/schema/index.js'
import type { InteractionEventBody } from '@iptvflix/api-contracts'

export const ALLOWED_EVENT_TYPES = new Set([
  // Discovery / browsing
  'HOME_OPENED',
  'SHELF_IMPRESSION',
  'SHELF_VIEWED',
  'SHELF_ITEM_IMPRESSION',
  'SHELF_ITEM_OPENED',
  'DETAIL_OPENED',
  'TRAILER_PREVIEW_STARTED',
  'TRAILER_PREVIEW_COMPLETED',
  'PREVIEW_STARTED',
  'SEARCH_PERFORMED',
  'SEARCH_RESULT_IMPRESSION',
  'SEARCH_RESULT_OPENED',
  // Intent / explicit preference
  'MY_LIST_ADDED',
  'MY_LIST_REMOVED',
  'LIKED',
  'DISLIKED',
  'RATED',
  'CONTINUE_WATCHING_DISMISSED',
  'REMINDER_ADDED',
  // Playback
  'PLAY_STARTED',
  'PLAY_RESUMED',
  'PLAY_PAUSED',
  'PLAY_STOPPED',
  'PLAY_COMPLETED',
  'PLAY_ABANDONED',
  'SEEK_FORWARD',
  'SEEK_BACKWARD',
  'SKIP_INTRO',
  'SKIP_RECAP',
  'SKIP_OUTRO',
  'NEXT_EPISODE_AUTO',
  'NEXT_EPISODE_MANUAL',
  'SOURCE_SELECTED',
  'AUDIO_TRACK_SELECTED',
  'SUBTITLE_TRACK_SELECTED',
  'PLAYBACK_SPEED_CHANGED',
  'WATCHED_10_PERCENT',
  'WATCHED_25_PERCENT',
  'WATCHED_50_PERCENT',
  'WATCHED_75_PERCENT',
  'WATCHED_90_PERCENT',
  // Profile / settings
  'PROFILE_SELECTED',
  'PROFILE_PREFERENCE_CHANGED',
  'NEVER_STOP_ENABLED',
  'NEVER_STOP_DISABLED',
])

const MAX_METADATA_BYTES = 4096

function validateMetadata(meta: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!meta) return null
  const json = JSON.stringify(meta)
  if (json.length > MAX_METADATA_BYTES) {
    console.warn('[interaction-events] metadataJson exceeds 4KB, truncating to null')
    return null
  }
  return meta
}

export async function recordEvent(
  profileId: string,
  event: Omit<InteractionEventBody, 'profileId'>,
): Promise<void> {
  const key = event.idempotencyKey ?? null
  if (key) {
    const [existing] = await db
      .select({ id: profileInteractionEvents.id })
      .from(profileInteractionEvents)
      .where(eq(profileInteractionEvents.idempotencyKey, key))
    if (existing) return
  }

  await db.insert(profileInteractionEvents).values({
    profileId,
    mediaType: event.mediaType ?? null,
    mediaId: event.mediaId ?? null,
    episodeId: event.episodeId ?? null,
    eventType: event.eventType,
    occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    positionMs: event.positionMs ?? null,
    durationMs: event.durationMs ?? null,
    shelfId: event.shelfId ?? null,
    deviceType: event.deviceType ?? null,
    sourceId: event.sourceId ?? null,
    metadataJson: validateMetadata(event.metadataJson),
    seriesId: event.seriesId ?? null,
    seasonId: event.seasonId ?? null,
    seasonNumber: event.seasonNumber ?? null,
    progressPercent: event.progressPercent ?? null,
    shelfConceptId: event.shelfConceptId ?? null,
    shelfPosition: event.shelfPosition ?? null,
    itemPositionInShelf: event.itemPositionInShelf ?? null,
    searchQueryNormalized: event.searchQueryNormalized ?? null,
    availabilityId: event.availabilityId ?? null,
    clientType: event.clientType ?? null,
    appVersion: event.appVersion ?? null,
    sessionId: event.sessionId ?? null,
    referrerSurface: event.referrerSurface ?? null,
    schemaVersion: event.schemaVersion ?? 1,
    idempotencyKey: key,
  })
}

export async function recordEventBatch(
  profileId: string,
  events: Omit<InteractionEventBody, 'profileId'>[],
): Promise<void> {
  for (const event of events) {
    try {
      if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) continue
      await recordEvent(profileId, event)
    } catch (err) {
      console.warn('[interaction-events] batch item failed:', event.eventType, err)
    }
  }
}
