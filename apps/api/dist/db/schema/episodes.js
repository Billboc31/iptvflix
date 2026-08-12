import { pgTable, text, uuid, integer, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { seasons } from './seasons.js';
import { series } from './series.js';
export const episodes = pgTable('episodes', {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
        .references(() => seasons.id, { onDelete: 'cascade' })
        .notNull(),
    seriesId: uuid('series_id')
        .references(() => series.id, { onDelete: 'cascade' })
        .notNull(),
    episodeNumber: integer('episode_number').notNull(),
    title: text('title'),
    synopsis: text('synopsis'),
    durationMinutes: integer('duration_minutes'),
    airDate: date('air_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.seasonId, t.episodeNumber)]);
//# sourceMappingURL=episodes.js.map