import { pgTable, text, uuid, integer, timestamp, unique, index, doublePrecision, } from 'drizzle-orm/pg-core';
import { movies } from './movies.js';
import { series } from './series.js';
import { mediaTypeEnum } from './title-match-results.js';
export const discoveryCandidate = pgTable('discovery_candidates', {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id').notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    synopsis: text('synopsis'),
    posterPath: text('poster_path'),
    popularity: doublePrecision('popularity'),
    voteAverage: doublePrecision('vote_average'),
    releaseStatus: text('release_status'),
    provenance: text('provenance').notNull(),
    canonicalMovieId: uuid('canonical_movie_id').references(() => movies.id, {
        onDelete: 'set null',
    }),
    canonicalSeriesId: uuid('canonical_series_id').references(() => series.id, {
        onDelete: 'set null',
    }),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    unique().on(t.externalId, t.mediaType),
    index('discovery_candidates_expires_at_idx').on(t.expiresAt),
    index('discovery_candidates_media_type_expires_at_idx').on(t.mediaType, t.expiresAt),
]);
//# sourceMappingURL=discovery-candidates.js.map