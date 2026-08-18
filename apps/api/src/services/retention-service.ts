import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profileInteractionEvents } from '../db/schema/index.js'
import { RETENTION_DAYS, SEARCH_QUERY_ANONYMIZE_DAYS, getRetentionClass } from '../config/retention.js'

export async function runCompaction(): Promise<{ deleted: string; anonymized: string }> {
  const now = Date.now()

  // Anonymize search queries older than 90 days
  const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000)
  await db
    .update(profileInteractionEvents)
    .set({ searchQueryNormalized: null })
    .where(
      and(
        inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']),
        isNotNull(profileInteractionEvents.searchQueryNormalized),
        lt(profileInteractionEvents.occurredAt, searchCutoff),
      ),
    )

  // Delete ANALYTICS events older than 90 days
  const analyticsCutoff = new Date(now - 90 * 86_400_000)
  await db
    .delete(profileInteractionEvents)
    .where(
      and(
        inArray(profileInteractionEvents.eventType, [
          'SHELF_IMPRESSION',
          'SHELF_ITEM_IMPRESSION',
          'HOME_OPENED',
        ]),
        lt(profileInteractionEvents.occurredAt, analyticsCutoff),
      ),
    )

  // Delete STANDARD events older than 730 days
  const standardCutoff = new Date(now - 730 * 86_400_000)
  const standardTypes = [
    'PLAY_STARTED', 'PLAY_PAUSED', 'PLAY_STOPPED', 'PLAY_RESUMED', 'PLAY_ABANDONED',
    'DETAIL_OPENED', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SKIP_INTRO', 'SKIP_RECAP',
    'SKIP_OUTRO', 'NEXT_EPISODE_AUTO', 'NEXT_EPISODE_MANUAL', 'SOURCE_SELECTED',
    'AUDIO_TRACK_SELECTED', 'SUBTITLE_TRACK_SELECTED', 'PLAYBACK_SPEED_CHANGED',
    'SHELF_VIEWED', 'SHELF_ITEM_OPENED', 'TRAILER_PREVIEW_STARTED', 'TRAILER_PREVIEW_COMPLETED',
    'PREVIEW_STARTED', 'SEARCH_RESULT_OPENED', 'CONTINUE_WATCHING_DISMISSED',
    'PROFILE_SELECTED', 'PROFILE_PREFERENCE_CHANGED', 'NEVER_STOP_ENABLED', 'NEVER_STOP_DISABLED',
    'WATCHED_10_PERCENT', 'WATCHED_25_PERCENT', 'WATCHED_50_PERCENT', 'WATCHED_75_PERCENT',
  ]
  await db
    .delete(profileInteractionEvents)
    .where(
      and(
        inArray(profileInteractionEvents.eventType, standardTypes),
        lt(profileInteractionEvents.occurredAt, standardCutoff),
      ),
    )

  return { deleted: 'compacted', anonymized: 'compacted' }
}

export async function getRetentionStats(): Promise<{
  analyticsOverdue: number
  standardOverdue: number
  searchQueryOverdue: number
}> {
  const now = Date.now()
  const analyticsCutoff = new Date(now - 90 * 86_400_000)
  const standardCutoff = new Date(now - 730 * 86_400_000)
  const searchCutoff = new Date(now - SEARCH_QUERY_ANONYMIZE_DAYS * 86_400_000)

  const [[analyticsRow], [standardRow], [searchRow]] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)` })
      .from(profileInteractionEvents)
      .where(
        and(
          inArray(profileInteractionEvents.eventType, ['SHELF_IMPRESSION', 'SHELF_ITEM_IMPRESSION', 'HOME_OPENED']),
          lt(profileInteractionEvents.occurredAt, analyticsCutoff),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)` })
      .from(profileInteractionEvents)
      .where(lt(profileInteractionEvents.occurredAt, standardCutoff)),
    db
      .select({ c: sql<number>`count(*)` })
      .from(profileInteractionEvents)
      .where(
        and(
          inArray(profileInteractionEvents.eventType, ['SEARCH_PERFORMED', 'SEARCH_RESULT_IMPRESSION']),
          isNotNull(profileInteractionEvents.searchQueryNormalized),
          lt(profileInteractionEvents.occurredAt, searchCutoff),
        ),
      ),
  ])

  return {
    analyticsOverdue: Number(analyticsRow?.c ?? 0),
    standardOverdue: Number(standardRow?.c ?? 0),
    searchQueryOverdue: Number(searchRow?.c ?? 0),
  }
}
