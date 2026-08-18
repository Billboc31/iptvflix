import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'
import { progressMediaTypeEnum } from './viewing-progress.js'

export const continueWatchingDismissals = pgTable(
  'continue_watching_dismissals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: progressMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.mediaType, t.mediaId)],
)
