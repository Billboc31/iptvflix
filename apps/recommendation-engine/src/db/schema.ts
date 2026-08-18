import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  real,
  jsonb,
  varchar,
  boolean,
  customType,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const movies = pgTable('movies', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  year: integer('year'),
  durationMinutes: integer('duration_minutes'),
  synopsis: text('synopsis'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  tmdbId: integer('tmdb_id'),
  voteAverage: real('vote_average'),
  popularity: real('popularity'),
  originalLanguage: varchar('original_language', { length: 10 }),
  keywords: jsonb('keywords').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const series = pgTable('series', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  firstAirYear: integer('first_air_year'),
  synopsis: text('synopsis'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  tmdbId: integer('tmdb_id'),
  voteAverage: real('vote_average'),
  popularity: real('popularity'),
  originalLanguage: varchar('original_language', { length: 10 }),
  keywords: jsonb('keywords').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const genres = pgTable('genres', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  tmdbId: integer('tmdb_id'),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  isKids: boolean('is_kids').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

const float8Array = customType<{ data: number[]; driverData: number[] | string }>({
  dataType() {
    return 'double precision[]'
  },
  fromDriver(value: number[] | string): number[] {
    if (Array.isArray(value)) return value.map(Number)
    if (typeof value === 'string') {
      return value.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number)
    }
    return []
  },
  toDriver(value: number[]): number[] {
    return value
  },
})

export const mediaEmbeddings = pgTable(
  'media_embeddings',
  {
    id: uuid('id').primaryKey(),
    mediaId: uuid('media_id').notNull(),
    mediaType: text('media_type').notNull(),
    embedding: float8Array('embedding').notNull(),
    modelProvider: text('model_provider').notNull(),
    modelName: text('model_name').notNull(),
    embeddingDimension: integer('embedding_dimension').notNull(),
    docHash: text('doc_hash').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('media_embeddings_media_model_idx_re').on(
      t.mediaId,
      t.mediaType,
      t.modelProvider,
      t.modelName,
    ),
  ],
)
