import { pgTable, text, uuid, integer, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const enrichmentFailures = pgTable(
  'enrichment_failures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    tmdbId: integer('tmdb_id'),
    title: text('title'),
    stage: text('stage').notNull(),
    errorClass: text('error_class'),
    errorCode: text('error_code'),
    errorMessage: text('error_message').notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    retryable: boolean('retryable').notNull().default(false),
    runId: uuid('run_id'),
  },
  (t) => [uniqueIndex('enrichment_failures_media_idx').on(t.mediaType, t.mediaId)],
)
