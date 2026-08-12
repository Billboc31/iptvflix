import { pgTable, pgEnum, uuid, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { sources } from './sources.js'
import { watchlistMediaTypeEnum } from './watchlist.js'
import { profiles } from './profiles.js'

export const releaseEventTypeEnum = pgEnum('release_event_type', [
  'ANNOUNCED',
  'THEATRICAL_RELEASE',
  'DIGITAL_RELEASE',
  'SOURCE_APPEARED',
  'SOURCE_DISAPPEARED',
])

export const releaseEvents = pgTable(
  'release_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaType: watchlistMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    eventType: releaseEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('release_events_source_events_unique')
      .on(t.mediaType, t.mediaId, t.eventType, t.occurredAt, t.sourceId)
      .where(sql`event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`),
    uniqueIndex('release_events_non_source_events_unique')
      .on(t.mediaType, t.mediaId, t.eventType, t.occurredAt)
      .where(sql`event_type NOT IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`),
  ],
)

export const followRelease = pgTable(
  'follow_release',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: watchlistMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    followedAt: timestamp('followed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.mediaType, t.mediaId)],
)
