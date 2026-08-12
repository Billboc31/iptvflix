import { pgTable, pgEnum, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
import { devices } from './devices.js'

export const playbackMediaTypeEnum = pgEnum('playback_media_type', ['movie', 'episode'])
export const commandStateEnum = pgEnum('command_state', ['pending', 'delivered', 'acknowledged', 'expired'])

export const playbackCommands = pgTable('playback_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id')
    .references(() => devices.id, { onDelete: 'cascade' })
    .notNull(),
  mediaType: playbackMediaTypeEnum('media_type').notNull(),
  mediaId: uuid('media_id').notNull(),
  availabilityId: uuid('availability_id'),
  startPositionMs: integer('start_position_ms').notNull().default(0),
  state: commandStateEnum('state').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
