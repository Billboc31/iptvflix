import { pgTable, pgEnum, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'
import { watchlistMediaTypeEnum } from './watchlist.js'

export const feedbackTypeEnum = pgEnum('feedback_type', ['LIKE', 'DISLIKE', 'NOT_INTERESTED'])

export const explicitFeedback = pgTable(
  'explicit_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: watchlistMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    feedback: feedbackTypeEnum('feedback').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.mediaType, t.mediaId)],
)
