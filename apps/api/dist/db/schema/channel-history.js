import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { profiles } from './profiles.js';
export const channelHistory = pgTable('channel_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
        .notNull()
        .references(() => profiles.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
        .notNull()
        .references(() => channels.id, { onDelete: 'cascade' }),
    watchedAt: timestamp('watched_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=channel-history.js.map