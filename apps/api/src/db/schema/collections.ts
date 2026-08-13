import { pgTable, text, uuid, integer, timestamp } from 'drizzle-orm/pg-core'

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: text('name').notNull(),
  overview: text('overview'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
