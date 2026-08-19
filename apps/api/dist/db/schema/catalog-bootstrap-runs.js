import { pgTable, text, uuid, integer, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const catalogBootstrapRuns = pgTable('catalog_bootstrap_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status').notNull().default('PENDING'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    checkpoint: jsonb('checkpoint').$type(),
    moviesCreated: integer('movies_created').notNull().default(0),
    moviesUpdated: integer('movies_updated').notNull().default(0),
    seriesCreated: integer('series_created').notNull().default(0),
    seriesUpdated: integer('series_updated').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errorMessage: text('error_message'),
}, (t) => [
    uniqueIndex('catalog_bootstrap_runs_running_idx')
        .on(t.status)
        .where(sql `"status" = 'RUNNING'`),
]);
//# sourceMappingURL=catalog-bootstrap-runs.js.map