import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const profileInteractionEvents = pgTable(
  'profile_interaction_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    mediaType: text('media_type'),
    mediaId: uuid('media_id'),
    episodeId: uuid('episode_id'),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    positionMs: integer('position_ms'),
    durationMs: integer('duration_ms'),
    shelfId: uuid('shelf_id'),
    deviceType: text('device_type'),
    sourceId: uuid('source_id'),
    metadataJson: jsonb('metadata_json'),
  },
  (t) => [index('profile_interaction_events_profile_occurred_idx').on(t.profileId, t.occurredAt)],
)
