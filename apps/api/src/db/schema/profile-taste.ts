import { pgTable, uuid, jsonb, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { profiles } from './profiles.js'

export const profileTaste = pgTable('profile_taste', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  genreScores: jsonb('genre_scores').notNull().default({}),
  genreMeta: jsonb('genre_meta').notNull().default({}),
  positiveMediaIds: text('positive_media_ids').array().notNull().default(sql`'{}'`),
  negativeMediaIds: text('negative_media_ids').array().notNull().default(sql`'{}'`),
  signalCount: integer('signal_count').notNull().default(0),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull(),
  // T100 additions
  personScores: jsonb('person_scores').notNull().default({}),
  personMeta: jsonb('person_meta').notNull().default({}),
  keywordScores: jsonb('keyword_scores').notNull().default({}),
  franchiseScores: jsonb('franchise_scores').notNull().default({}),
  languageScores: jsonb('language_scores').notNull().default({}),
  countryScores: jsonb('country_scores').notNull().default({}),
  decadeScores: jsonb('decade_scores').notNull().default({}),
  mediaTypePreferences: jsonb('media_type_preferences').notNull().default({}),
  completionRate: numeric('completion_rate'),
  avgProgressPercent: integer('avg_progress_percent'),
  tasteVersion: integer('taste_version').notNull().default(1),
  historyEventCount: integer('history_event_count').notNull().default(0),
})
