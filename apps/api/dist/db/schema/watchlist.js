import { pgTable, pgEnum, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
export const watchlistMediaTypeEnum = pgEnum('watchlist_media_type', ['MOVIE', 'SERIES']);
export const watchlist = pgTable('watchlist', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
        .references(() => profiles.id, { onDelete: 'cascade' })
        .notNull(),
    mediaType: watchlistMediaTypeEnum('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.profileId, t.mediaType, t.mediaId)]);
//# sourceMappingURL=watchlist.js.map