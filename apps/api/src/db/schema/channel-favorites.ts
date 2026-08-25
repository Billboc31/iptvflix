import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { channels } from './channels.js'
import { profiles } from './profiles.js'

export const channelFavorites = pgTable(
  'channel_favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.channelId)],
)
