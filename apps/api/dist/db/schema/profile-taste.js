import { pgTable, uuid, jsonb, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles.js';
export const profileTaste = pgTable('profile_taste', {
    profileId: uuid('profile_id')
        .primaryKey()
        .references(() => profiles.id, { onDelete: 'cascade' }),
    genreScores: jsonb('genre_scores').notNull().default({}),
    genreMeta: jsonb('genre_meta').notNull().default({}),
    positiveMediaIds: text('positive_media_ids').array().notNull().default(sql `'{}'`),
    negativeMediaIds: text('negative_media_ids').array().notNull().default(sql `'{}'`),
    signalCount: integer('signal_count').notNull().default(0),
    builtAt: timestamp('built_at', { withTimezone: true }).notNull(),
});
//# sourceMappingURL=profile-taste.js.map