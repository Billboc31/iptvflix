import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'
import { recommendationHomeSessions } from './recommendation-home-sessions.js'

export const homeDiscoverySnapshots = pgTable(
  'home_discovery_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => recommendationHomeSessions.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    declaredShelfInstanceIds: text('declared_shelf_instance_ids').array().notNull().default([]),
    heroMediaId: text('hero_media_id'),
    heroMediaType: text('hero_media_type'),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.profileId)],
)
