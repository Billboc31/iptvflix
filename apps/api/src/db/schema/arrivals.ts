import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'
import { sources } from './sources.js'
import { releaseEvents } from './release-lifecycle.js'
import { watchlistMediaTypeEnum } from './watchlist.js'

export const mediaArrivals = pgTable(
  'media_arrivals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaType: watchlistMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
    releaseEventId: uuid('release_event_id')
      .references(() => releaseEvents.id, { onDelete: 'restrict' })
      .notNull(),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.releaseEventId)],
)
