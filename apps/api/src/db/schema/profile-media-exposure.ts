import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const profileMediaExposure = pgTable(
  'profile_media_exposure',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    exposureCount: integer('exposure_count').notNull().default(0),
    firstExposedAt: timestamp('first_exposed_at', { withTimezone: true }).notNull().defaultNow(),
    lastExposedAt: timestamp('last_exposed_at', { withTimezone: true }).notNull().defaultNow(),
    openCount: integer('open_count').notNull().default(0),
    playCount: integer('play_count').notNull().default(0),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    shownInConceptIds: jsonb('shown_in_concept_ids').notNull().default([]),
  },
  (t) => [
    uniqueIndex('profile_media_exposure_profile_type_media_idx').on(
      t.profileId,
      t.mediaType,
      t.mediaId,
    ),
    index('profile_media_exposure_profile_exposed_idx').on(t.profileId, t.lastExposedAt),
  ],
)
