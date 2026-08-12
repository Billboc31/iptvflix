import { pgTable, text, uuid, integer, timestamp, date, primaryKey, real } from 'drizzle-orm/pg-core'
import { genres } from './genres.js'

export const movies = pgTable('movies', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  year: integer('year'),
  durationMinutes: integer('duration_minutes'),
  synopsis: text('synopsis'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  tmdbId: integer('tmdb_id').unique(),
  imdbId: text('imdb_id').unique(),
  voteAverage: real('vote_average'),
  certification: text('certification'),
  metadataProvider: text('metadata_provider'),
  metadataEnrichedAt: timestamp('metadata_enriched_at', { withTimezone: true }),
  announcedAt: date('announced_at'),
  theatricalReleaseDate: date('theatrical_release_date'),
  digitalReleaseDate: date('digital_release_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const movieGenres = pgTable(
  'movie_genres',
  {
    movieId: uuid('movie_id')
      .references(() => movies.id, { onDelete: 'cascade' })
      .notNull(),
    genreId: uuid('genre_id')
      .references(() => genres.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.genreId] })],
)
