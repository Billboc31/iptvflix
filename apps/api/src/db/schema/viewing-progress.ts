import { pgTable, pgEnum, uuid, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const progressMediaTypeEnum = pgEnum('progress_media_type', ['MOVIE', 'EPISODE'])

export const viewingProgress = pgTable(
  'viewing_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: progressMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    progressSeconds: integer('progress_seconds').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.mediaType, t.mediaId)],
)
