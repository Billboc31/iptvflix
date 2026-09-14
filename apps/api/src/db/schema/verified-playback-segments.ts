import { pgTable, uuid, integer, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { episodeAvailabilities } from './availabilities.js'
import { segmentTypeEnum } from './media-segments.js'
export const verifiedPlaybackSegments = pgTable('verified_playback_segments', {
  availabilityId: uuid('availability_id').notNull().references(() => episodeAvailabilities.id, { onDelete: 'cascade' }),
  type: segmentTypeEnum('type').notNull(),
  durationMs: integer('duration_ms').notNull(),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  evidence: text('evidence').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.availabilityId, t.type] })])
