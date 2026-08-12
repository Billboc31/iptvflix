import { pgTable, pgEnum, text, uuid, varchar, integer, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { movies } from './movies.js';
import { series } from './series.js';
import { sources } from './sources.js';
export const matchStateEnum = pgEnum('match_state', ['MATCHED', 'UNMATCHED', 'AMBIGUOUS']);
export const mediaTypeEnum = pgEnum('media_type', ['MOVIE', 'SERIES']);
export const titleMatchResults = pgTable('title_match_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
        .references(() => sources.id, { onDelete: 'cascade' })
        .notNull(),
    providerItemId: varchar('provider_item_id', { length: 255 }).notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    rawTitle: text('raw_title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    extractedYear: integer('extracted_year'),
    matchState: matchStateEnum('match_state').notNull(),
    movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'set null' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'set null' }),
    confidence: numeric('confidence', { precision: 5, scale: 4 }),
    candidateCount: integer('candidate_count').notNull().default(0),
    notes: text('notes'),
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.providerId, t.providerItemId)]);
//# sourceMappingURL=title-match-results.js.map