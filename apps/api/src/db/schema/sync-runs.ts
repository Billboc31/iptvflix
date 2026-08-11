import { pgTable, pgEnum, text, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { sources } from './sources.js'

export const syncRunStatusEnum = pgEnum('sync_run_status', ['RUNNING', 'COMPLETED', 'FAILED'])

export const syncRuns = pgTable(
  'sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .references(() => sources.id, { onDelete: 'cascade' })
      .notNull(),
    status: syncRunStatusEnum('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    moviesCreated: integer('movies_created').notNull().default(0),
    moviesUpdated: integer('movies_updated').notNull().default(0),
    seriesCreated: integer('series_created').notNull().default(0),
    seriesUpdated: integer('series_updated').notNull().default(0),
    unavailableCount: integer('unavailable_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [
    uniqueIndex('sync_runs_source_running_idx')
      .on(t.sourceId)
      .where(sql`"status" = 'RUNNING'`),
  ],
)
