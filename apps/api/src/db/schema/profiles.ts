import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  preferredAudioLanguages: text('preferred_audio_languages').array().notNull().default(sql`'{}'`),
  preferredSubtitleLanguages: text('preferred_subtitle_languages').array().notNull().default(sql`'{}'`),
  preferredSourceIds: text('preferred_source_ids').array().notNull().default(sql`'{}'`),
  maxVideoQuality: text('max_video_quality'),
  autoplayPreviews: boolean('autoplay_previews').notNull().default(true),
})
