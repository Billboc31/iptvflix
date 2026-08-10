import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { movies } from './movies.js'
import { episodes } from './episodes.js'

export const movieAvailabilities = pgTable(
  'movie_availabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movieId: uuid('movie_id')
      .references(() => movies.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: text('provider_id').notNull(),
    providerItemId: text('provider_item_id').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.movieId, t.providerId, t.providerItemId)],
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
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.episodeId, t.providerId, t.providerItemId)],
)
