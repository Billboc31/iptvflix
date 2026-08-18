import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
} from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'
import { shelfConcepts } from './shelf-concepts.js'

export const shelfInstances = pgTable(
  'shelf_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    shelfConceptId: uuid('shelf_concept_id').references(() => shelfConcepts.id),
    title: text('title').notNull(),
    semanticIntentSnapshot: text('semantic_intent_snapshot'),
    generationType: text('generation_type'),
    generationReasonCodes: jsonb('generation_reason_codes').notNull().default([]),
    homeSessionId: uuid('home_session_id'),
    verticalPosition: integer('vertical_position'),
    rankerVersion: text('ranker_version').notNull(),
    queryPlannerVersion: text('query_planner_version').notNull(),
    embeddingModelVersion: text('embedding_model_version').notNull(),
    candidateCount: integer('candidate_count'),
    finalItemCount: integer('final_item_count'),
    latencyMs: integer('latency_ms'),
    cacheHit: boolean('cache_hit').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    firstDisplayedAt: timestamp('first_displayed_at', { withTimezone: true }),
    lastDisplayedAt: timestamp('last_displayed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('shelf_instances_profile_created_idx').on(t.profileId, t.createdAt),
    index('shelf_instances_concept_created_idx').on(t.shelfConceptId, t.createdAt),
  ],
)

export const shelfInstanceItems = pgTable(
  'shelf_instance_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shelfInstanceId: uuid('shelf_instance_id')
      .notNull()
      .references(() => shelfInstances.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    rankPosition: integer('rank_position').notNull(),
    semanticScore: real('semantic_score'),
    profileScore: real('profile_score'),
    finalScore: real('final_score'),
    diversityAdjustment: real('diversity_adjustment'),
    availabilityStatus: text('availability_status'),
    reasonCodes: jsonb('reason_codes').notNull().default([]),
    wasEligibleAtGeneration: boolean('was_eligible_at_generation').notNull().default(true),
    wasVisible: boolean('was_visible').notNull().default(false),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    playedAt: timestamp('played_at', { withTimezone: true }),
  },
  (t) => [
    index('shelf_instance_items_instance_rank_idx').on(t.shelfInstanceId, t.rankPosition),
  ],
)
