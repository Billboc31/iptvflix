import { pgTable, text, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
export const genres = pgTable('genres', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // TMDB genre ID for cross-referencing
    tmdbId: integer('tmdb_id').unique(),
});
//# sourceMappingURL=genres.js.map