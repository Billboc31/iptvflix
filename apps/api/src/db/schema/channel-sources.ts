import { pgTable, text, uuid, timestamp, integer, real, jsonb, unique } from 'drizzle-orm/pg-core'
import { channels } from './channels.js'
import { sources } from './sources.js'
import { availabilityStatusEnum } from './availabilities.js'

export const channelSources = pgTable(
  'channel_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .references(() => channels.id, { onDelete: 'cascade' })
      .notNull(),
    sourceId: uuid('source_id')
      .references(() => sources.id, { onDelete: 'cascade' })
      .notNull(),
    providerItemId: text('provider_item_id').notNull(),
    providerName: text('provider_name').notNull(),
    streamUrl: text('stream_url').notNull(),
    tvgId: text('tvg_id'),
    tvgLogo: text('tvg_logo'),
    groupTitle: text('group_title'),
    priority: integer('priority').notNull().default(0),
    matchConfidence: real('match_confidence').notNull(),
    matchProvenance: jsonb('match_provenance').$type<Record<string, unknown>>().notNull(),
    status: availabilityStatusEnum('status').notNull().default('AVAILABLE'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.sourceId, t.providerItemId)],
)
