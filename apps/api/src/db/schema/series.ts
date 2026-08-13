import { pgTable, text, uuid, integer, timestamp, date, primaryKey, real, jsonb, varchar, boolean } from 'drizzle-orm/pg-core'
import { genres } from './genres.js'
import { matchStatusEnum } from './movies.js'

type SpokenLanguage = { iso639_1: string; name: string }
type ProductionCountry = { iso3166_1: string; name: string }
type Network = { id: number; name: string; logoPath: string | null; originCountry: string }
type CreatedBy = { id: number; name: string; profilePath: string | null }

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
  voteAverage: real('vote_average'),
  certification: text('certification'),
  status: text('status'),
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
  inProduction: boolean('in_production'),
  networks: jsonb('networks').$type<Network[]>(),
  createdBy: jsonb('created_by').$type<CreatedBy[]>(),
  numberOfSeasons: integer('number_of_seasons'),
  numberOfEpisodes: integer('number_of_episodes'),
  keywords: jsonb('keywords').$type<string[]>(),
  externalIds: jsonb('external_ids').$type<Record<string, string | number | null>>(),
  tmdbSyncedAt: timestamp('tmdb_synced_at', { withTimezone: true }),
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
