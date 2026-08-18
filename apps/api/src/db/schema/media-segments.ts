import { pgTable, uuid, integer, text, real, timestamp, unique, pgEnum } from 'drizzle-orm/pg-core'
import { episodes } from './episodes.js'

export const segmentTypeEnum = pgEnum('segment_type', ['RECAP', 'INTRO', 'OUTRO', 'CREDITS', 'PREVIEW'])

export const mediaSegments = pgTable(
  'media_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    episodeId: uuid('episode_id')
      .references(() => episodes.id, { onDelete: 'cascade' })
      .notNull(),
    type: segmentTypeEnum('type').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    sourceProvider: text('source_provider').notNull(),
    sourceExternalId: text('source_external_id'),
    confidence: real('confidence'),
    submissionCount: integer('submission_count'),
    status: text('status'),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.episodeId, t.type, t.sourceProvider)],
)
