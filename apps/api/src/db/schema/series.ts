import { pgTable, text, uuid, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { genres } from './genres.js'

export const series = pgTable('series', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  firstAirYear: integer('first_air_year'),
  synopsis: text('synopsis'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  tmdbId: integer('tmdb_id').unique(),
  imdbId: text('imdb_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const seriesGenres = pgTable(
  'series_genres',
  {
    seriesId: uuid('series_id')
      .references(() => series.id, { onDelete: 'cascade' })
      .notNull(),
    genreId: uuid('genre_id')
      .references(() => genres.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.genreId] })],
)
