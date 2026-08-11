import { pgTable, pgEnum, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { movies } from './movies.js'
import { series } from './series.js'
import { episodes } from './episodes.js'

export const availabilityStatusEnum = pgEnum('availability_status', ['AVAILABLE', 'UNAVAILABLE'])

export const movieAvailabilities = pgTable(
  'movie_availabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movieId: uuid('movie_id')
      .references(() => movies.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: text('provider_id').notNull(),
    providerItemId: text('provider_item_id').notNull(),
    status: availabilityStatusEnum('status').notNull().default('AVAILABLE'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    audioLanguage: text('audio_language'),
    subtitleLanguage: text('subtitle_language'),
    videoQuality: text('video_quality'),
    rawTitle: text('raw_title'),
  },
  (t) => [
    unique().on(t.movieId, t.providerId, t.providerItemId),
    unique().on(t.providerId, t.providerItemId),
  ],
)

export const seriesAvailabilities = pgTable(
  'series_availabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seriesId: uuid('series_id')
      .references(() => series.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: text('provider_id').notNull(),
    providerItemId: text('provider_item_id').notNull(),
    status: availabilityStatusEnum('status').notNull().default('AVAILABLE'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    audioLanguage: text('audio_language'),
    subtitleLanguage: text('subtitle_language'),
    videoQuality: text('video_quality'),
    rawTitle: text('raw_title'),
  },
  (t) => [
    unique().on(t.seriesId, t.providerId, t.providerItemId),
    unique().on(t.providerId, t.providerItemId),
  ],
)

export const episodeAvailabilities = pgTable(
  'episode_availabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    episodeId: uuid('episode_id')
      .references(() => episodes.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: text('provider_id').notNull(),
    providerItemId: text('provider_item_id').notNull(),
    status: availabilityStatusEnum('status').notNull().default('AVAILABLE'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    audioLanguage: text('audio_language'),
    subtitleLanguage: text('subtitle_language'),
    videoQuality: text('video_quality'),
    rawTitle: text('raw_title'),
  },
  (t) => [unique().on(t.episodeId, t.providerId, t.providerItemId)],
)
