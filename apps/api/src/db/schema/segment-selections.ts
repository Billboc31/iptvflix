import { pgTable, uuid, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { episodes } from './episodes.js'
import { segmentTypeEnum } from './media-segments.js'
import type { ProvenanceEntry } from '../../services/segment-merger.js'

export const segmentSelections = pgTable(
  'segment_selections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    episodeId: uuid('episode_id')
      .references(() => episodes.id, { onDelete: 'cascade' })
      .notNull(),
    type: segmentTypeEnum('type').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    selectedProvider: text('selected_provider').notNull(),
    selectionReason: text('selection_reason').notNull(),
    provenance: jsonb('provenance').$type<ProvenanceEntry[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.episodeId, t.type)],
)
