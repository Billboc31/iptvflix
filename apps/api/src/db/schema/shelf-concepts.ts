import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { profiles } from './profiles.js'

export const shelfConceptGenerationTypeEnum = pgEnum('shelf_concept_generation_type', [
  'PERSONALIZED',
  'EXPLORATION',
  'DISCOVERY',
  'FIXED',
  'EDITORIAL',
])

export const shelfConcepts = pgTable(
  'shelf_concepts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    rawIntent: text('raw_intent').notNull(),
    semanticIntent: text('semantic_intent').notNull(),
    generationType: shelfConceptGenerationTypeEnum('generation_type').notNull(),
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
  (t) => [
    index('shelf_concepts_profile_active_created_idx').on(t.profileId, t.active, t.createdAt),
  ],
)
