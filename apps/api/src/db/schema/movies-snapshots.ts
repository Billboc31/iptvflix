import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const moviesDiscoverySnapshots = pgTable(
  'movies_discovery_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    declaredShelfInstanceIds: text('declared_shelf_instance_ids').array().notNull().default([]),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.profileId)],
)
