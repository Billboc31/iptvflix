import { pgTable, text, uuid, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { series } from './series.js';
export const seasons = pgTable('seasons', {
    id: uuid('id').primaryKey().defaultRandom(),
    seriesId: uuid('series_id')
        .references(() => series.id, { onDelete: 'cascade' })
        .notNull(),
    seasonNumber: integer('season_number').notNull(),
    title: text('title'),
    airYear: integer('air_year'),
    synopsis: text('synopsis'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // TMDB-first catalog fields
    tmdbId: integer('tmdb_id').unique(),
    posterPath: text('poster_path'),
    episodeCount: integer('episode_count'),
}, (t) => [unique().on(t.seriesId, t.seasonNumber)]);
//# sourceMappingURL=seasons.js.map