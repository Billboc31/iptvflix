import { pgTable, uuid, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
export const persons = pgTable('persons', {
    id: uuid('id').primaryKey().defaultRandom(),
    tmdbPersonId: integer('tmdb_person_id').notNull(),
    name: text('name').notNull(),
    profilePath: text('profile_path'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('persons_tmdb_person_id_unique').on(t.tmdbPersonId)]);
//# sourceMappingURL=persons.js.map