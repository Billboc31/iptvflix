import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts.js';
export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    avatarKey: text('avatar_key'),
    isKids: boolean('is_kids').notNull().default(false),
    maturityLevel: text('maturity_level'),
    preferredUiLanguage: text('preferred_ui_language'),
    preferredAudioLanguages: text('preferred_audio_languages').array().notNull().default(sql `'{}'`),
    preferredSubtitleLanguages: text('preferred_subtitle_languages').array().notNull().default(sql `'{}'`),
    preferredSourceIds: text('preferred_source_ids').array().notNull().default(sql `'{}'`),
    maxVideoQuality: text('max_video_quality'),
    subtitlesEnabledPreference: boolean('subtitles_enabled_preference'),
    autoplayPreviews: boolean('autoplay_previews').notNull().default(true),
    autoplayNextEpisode: boolean('autoplay_next_episode').notNull().default(true),
    autoSkipIntro: boolean('auto_skip_intro').notNull().default(false),
    autoSkipRecap: boolean('auto_skip_recap').notNull().default(false),
    neverStopMode: boolean('never_stop_mode').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});
//# sourceMappingURL=profiles.js.map