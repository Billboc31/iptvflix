import { db } from '../db/client.js'
import { profileInteractionEvents } from '../db/schema/index.js'
import type { InteractionEventBody } from '@iptvflix/api-contracts'

export const ALLOWED_EVENT_TYPES = new Set([
  'DETAIL_OPENED',
  'PLAY_STARTED',
  'PLAY_RESUMED',
  'PLAY_PAUSED',
  'PLAY_COMPLETED',
  'PLAY_ABANDONED',
  'MY_LIST_ADDED',
  'MY_LIST_REMOVED',
  'LIKED',
  'DISLIKED',
  'SEARCH_PERFORMED',
  'SEARCH_RESULT_OPENED',
  'SHELF_IMPRESSION',
  'SHELF_ITEM_OPENED',
  'PREVIEW_STARTED',
  'SOURCE_SELECTED',
])

export async function recordEvent(
  profileId: string,
  event: Omit<InteractionEventBody, 'profileId'>,
): Promise<void> {
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
    metadataJson: event.metadataJson ?? null,
  })
}
