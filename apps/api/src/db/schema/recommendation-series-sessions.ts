import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const recommendationSeriesSessions = pgTable(
  'recommendation_series_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    modelVersion: text('model_version').notNull(),
    cursorReference: text('cursor_reference'),
  },
  (t) => [
    index('recommendation_series_sessions_profile_started_idx').on(t.profileId, t.startedAt),
  ],
)
