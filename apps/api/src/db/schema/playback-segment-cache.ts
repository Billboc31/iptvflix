import { pgTable, text, jsonb, timestamp, uuid, primaryKey } from 'drizzle-orm/pg-core'
import type { EpisodeSegmentItem } from '@iptvflix/api-contracts'

export const playbackSegmentResponses = pgTable('playback_segment_responses', {
  url: text('url').primaryKey(),
  payload: jsonb('payload').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})
export const playbackSegmentCatalog = pgTable('playback_segment_catalog', {
  mediaType: text('media_type').notNull(),
  mediaId: uuid('media_id').notNull(),
  segments: jsonb('segments').$type<EpisodeSegmentItem[]>().notNull().default([]),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  retryAt: timestamp('retry_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
}, t => [primaryKey({ columns: [t.mediaType, t.mediaId] })])
