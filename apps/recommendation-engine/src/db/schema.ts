import {
  pgTable,
  pgEnum,
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
  primaryKey,
  doublePrecision,
  numeric,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Core catalog tables ──────────────────────────────────────────────────────

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
  collectionId: uuid('collection_id'),
  status: text('status'),
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
  status: text('status'),
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
  preferredAudioLanguages: text('preferred_audio_languages').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Genre junction tables ─────────────────────────────────────────────────────

export const movieGenres = pgTable(
  'movie_genres',
  {
    movieId: uuid('movie_id').notNull(),
    genreId: uuid('genre_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.genreId] })],
)

export const seriesGenres = pgTable(
  'series_genres',
  {
    seriesId: uuid('series_id').notNull(),
    genreId: uuid('genre_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.genreId] })],
)

// ─── Media credits ────────────────────────────────────────────────────────────

export const mediaCredits = pgTable('media_credits', {
  id: uuid('id').primaryKey(),
  mediaType: text('media_type').notNull(),
  mediaId: uuid('media_id').notNull(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  character: text('character'),
  creditOrder: integer('credit_order').notNull(),
})

// ─── Availabilities ───────────────────────────────────────────────────────────

export const movieAvailabilities = pgTable('movie_availabilities', {
  id: uuid('id').primaryKey(),
  movieId: uuid('movie_id').notNull(),
  status: text('status').notNull(),
})

export const seriesAvailabilities = pgTable('series_availabilities', {
  id: uuid('id').primaryKey(),
  seriesId: uuid('series_id').notNull(),
  status: text('status').notNull(),
})

// ─── Viewing progress ──────────────────────────────────────────────────────────

export const viewingProgress = pgTable('viewing_progress', {
  id: uuid('id').primaryKey(),
  profileId: uuid('profile_id').notNull(),
  mediaType: text('media_type').notNull(),
  mediaId: uuid('media_id').notNull(),
  progressSeconds: integer('progress_seconds').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
})

// ─── Profile taste ─────────────────────────────────────────────────────────────

export const profileTaste = pgTable('profile_taste', {
  profileId: uuid('profile_id').primaryKey(),
  genreScores: jsonb('genre_scores').notNull().default({}),
  genreMeta: jsonb('genre_meta').notNull().default({}),
  positiveMediaIds: text('positive_media_ids').array().notNull().default(sql`'{}'`),
  negativeMediaIds: text('negative_media_ids').array().notNull().default(sql`'{}'`),
  signalCount: integer('signal_count').notNull().default(0),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull(),
})

// ─── Profile interaction events ───────────────────────────────────────────────

export const profileInteractionEvents = pgTable(
  'profile_interaction_events',
  {
    id: uuid('id').primaryKey(),
    profileId: uuid('profile_id').notNull(),
    mediaType: text('media_type'),
    mediaId: uuid('media_id'),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('re_pie_profile_occurred_idx').on(t.profileId, t.occurredAt)],
)

// ─── Media embeddings ─────────────────────────────────────────────────────────

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

// ─── Shelf concepts ───────────────────────────────────────────────────────────

export const shelfConcepts = pgTable(
  'shelf_concepts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id'),
    title: text('title').notNull(),
    rawIntent: text('raw_intent').notNull(),
    semanticIntent: text('semantic_intent').notNull(),
    generationType: text('generation_type').notNull(),
    reasonCodes: jsonb('reason_codes').notNull().default([]),
    sourceModel: text('source_model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    desiredMediaTypes: jsonb('desired_media_types').notNull().default([]),
    freshnessPolicy: text('freshness_policy'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    reachCount: integer('reach_count').notNull().default(0),
    openCount: integer('open_count').notNull().default(0),
    playCount: integer('play_count').notNull().default(0),
    completionCount: integer('completion_count').notNull().default(0),
    dismissCount: integer('dismiss_count').notNull().default(0),
  },
  (t) => [index('re_shelf_concepts_profile_active_idx').on(t.profileId, t.active, t.createdAt)],
)

// ─── Shelf concept fatigue ─────────────────────────────────────────────────────

export const shelfConceptFatigue = pgTable(
  'shelf_concept_fatigue',
  {
    id: uuid('id').primaryKey(),
    profileId: uuid('profile_id').notNull(),
    shelfConceptId: uuid('shelf_concept_id').notNull(),
    impressionCount: integer('impression_count').notNull().default(0),
    visibleImpressionCount: integer('visible_impression_count').notNull().default(0),
    zeroInteractionStreakCount: integer('zero_interaction_streak_count').notNull().default(0),
    lastShownAt: timestamp('last_shown_at', { withTimezone: true }),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    suppressionReason: text('suppression_reason'),
    suppressionVersion: text('suppression_version'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('re_shelf_concept_fatigue_profile_concept_idx').on(t.profileId, t.shelfConceptId)],
)

// ─── Discovery candidates ─────────────────────────────────────────────────────

export const discoveryCandidate = pgTable(
  'discovery_candidates',
  {
    id: uuid('id').primaryKey(),
    externalId: text('external_id').notNull(),
    mediaType: text('media_type').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    synopsis: text('synopsis'),
    posterPath: text('poster_path'),
    popularity: doublePrecision('popularity'),
    voteAverage: doublePrecision('vote_average'),
    provenance: text('provenance').notNull(),
    canonicalMovieId: uuid('canonical_movie_id'),
    canonicalSeriesId: uuid('canonical_series_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('re_discovery_candidates_expires_at_idx').on(t.expiresAt)],
)

// ─── Shelves ──────────────────────────────────────────────────────────────────

export const shelves = pgTable('shelves', {
  id: uuid('id').primaryKey(),
  profileId: uuid('profile_id'),
  title: text('title').notNull(),
  type: text('type').notNull(),
  rules: jsonb('rules'),
  position: integer('position').notNull().default(0),
  layoutHint: text('layout_hint').notNull().default('ROW'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shelfMembers = pgTable(
  'shelf_members',
  {
    id: uuid('id').primaryKey(),
    shelfId: uuid('shelf_id').notNull(),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    position: integer('position').notNull().default(0),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('re_shelf_members_unique').on(t.shelfId, t.mediaType, t.mediaId)],
)
