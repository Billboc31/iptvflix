import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';
export const mediaVideos = pgTable('media_videos', {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaType: text('media_type').notNull(),
    mediaId: uuid('media_id').notNull(),
    youtubeKey: text('youtube_key').notNull(),
    videoType: text('video_type').notNull(),
    official: boolean('official').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=media-videos.js.map