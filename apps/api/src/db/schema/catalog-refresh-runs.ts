import { pgTable, text, uuid, integer, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

type RefreshCheckpoint = Record<string, { done: boolean; offset: number }>

export const catalogRefreshRuns = pgTable(
  'catalog_refresh_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status').notNull().default('PENDING'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    checkpoint: jsonb('checkpoint').$type<RefreshCheckpoint>(),
    moviesRefreshed: integer('movies_refreshed').notNull().default(0),
    seriesRefreshed: integer('series_refreshed').notNull().default(0),
    moviesImported: integer('movies_imported').notNull().default(0),
    seriesImported: integer('series_imported').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [
    uniqueIndex('catalog_refresh_runs_running_idx')
      .on(t.status)
      .where(sql`"status" = 'RUNNING'`),
  ],
)
