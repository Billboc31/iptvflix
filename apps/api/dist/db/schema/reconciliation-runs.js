import { pgTable, pgEnum, text, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['RUNNING', 'COMPLETED', 'FAILED']);
export const reconciliationRuns = pgTable('reconciliation_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    status: reconciliationStatusEnum('status').notNull(),
    mediaType: text('media_type').notNull().default('BOTH'),
    cursorMovieId: uuid('cursor_movie_id'),
    cursorSeriesId: uuid('cursor_series_id'),
    processedCount: integer('processed_count').notNull().default(0),
    matchedCount: integer('matched_count').notNull().default(0),
    mergedCount: integer('merged_count').notNull().default(0),
    ambiguousCount: integer('ambiguous_count').notNull().default(0),
    unmatchedCount: integer('unmatched_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
}, (t) => [
    uniqueIndex('reconciliation_runs_running_idx')
        .on(t.status)
        .where(sql `"status" = 'RUNNING'`),
]);
//# sourceMappingURL=reconciliation-runs.js.map