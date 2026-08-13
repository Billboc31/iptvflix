import { pgTable, pgEnum, text, uuid, integer, timestamp, date, primaryKey, real, jsonb, varchar, index } from 'drizzle-orm/pg-core'
import { genres } from './genres.js'
import { collections } from './collections.js'

export const matchStatusEnum = pgEnum('match_status', ['PENDING', 'MATCHED', 'UNMATCHED'])

type SpokenLanguage = { iso639_1: string; name: string }
type ProductionCountry = { iso3166_1: string; name: string }
type Localizations = { fr?: { title?: string; synopsis?: string; tagline?: string } }

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
  matchStatus: matchStatusEnum('match_status').notNull().default('PENDING'),
  metadataProvider: text('metadata_provider'),
  metadataEnrichedAt: timestamp('metadata_enriched_at', { withTimezone: true }),
  announcedAt: date('announced_at'),
  theatricalReleaseDate: date('theatrical_release_date'),
  digitalReleaseDate: date('digital_release_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // TMDB-first catalog fields
  popularity: real('popularity'),
  voteCount: integer('vote_count'),
  originalLanguage: varchar('original_language', { length: 10 }),
  spokenLanguages: jsonb('spoken_languages').$type<SpokenLanguage[]>(),
  productionCountries: jsonb('production_countries').$type<ProductionCountry[]>(),
  tagline: text('tagline'),
  status: text('status'),
  keywords: jsonb('keywords').$type<string[]>(),
  collectionId: uuid('collection_id').references(() => collections.id),
  externalIds: jsonb('external_ids').$type<Record<string, string | number | null>>(),
  tmdbSyncedAt: timestamp('tmdb_synced_at', { withTimezone: true }),
  localizations: jsonb('localizations').$type<Localizations>(),
}, (t) => [
  index('movies_popularity_idx').on(t.popularity),
  index('movies_vote_average_idx').on(t.voteAverage),
])

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
