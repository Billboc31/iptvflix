import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const viewingSessions = pgTable(
  'viewing_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    episodeId: uuid('episode_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    startPositionMs: integer('start_position_ms').notNull().default(0),
    endPositionMs: integer('end_position_ms'),
    maxPositionMs: integer('max_position_ms').notNull().default(0),
    watchedMsApprox: integer('watched_ms_approx').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    deviceType: text('device_type'),
    clientType: text('client_type'),
    sourceId: uuid('source_id'),
    availabilityId: uuid('availability_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('viewing_sessions_profile_media_idx').on(t.profileId, t.mediaId),
    index('viewing_sessions_profile_started_idx').on(t.profileId, t.startedAt),
  ],
)
