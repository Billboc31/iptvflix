import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles.js';
import { viewingSessions } from './viewing-sessions.js';
export const profileInteractionEvents = pgTable('profile_interaction_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    mediaType: text('media_type'),
    mediaId: uuid('media_id'),
    episodeId: uuid('episode_id'),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    positionMs: integer('position_ms'),
    durationMs: integer('duration_ms'),
    shelfId: uuid('shelf_id'),
    shelfInstanceId: uuid('shelf_instance_id'),
    deviceType: text('device_type'),
    sourceId: uuid('source_id'),
    metadataJson: jsonb('metadata_json'),
    // T100 additions
    seriesId: uuid('series_id'),
    seasonId: uuid('season_id'),
    seasonNumber: integer('season_number'),
    progressPercent: integer('progress_percent'),
    shelfConceptId: text('shelf_concept_id'),
    shelfPosition: integer('shelf_position'),
    itemPositionInShelf: integer('item_position_in_shelf'),
    searchQueryNormalized: text('search_query_normalized'),
    availabilityId: uuid('availability_id'),
    clientType: text('client_type'),
    appVersion: text('app_version'),
    sessionId: uuid('session_id').references(() => viewingSessions.id, { onDelete: 'set null' }),
    referrerSurface: text('referrer_surface'),
    schemaVersion: integer('schema_version').notNull().default(1),
    idempotencyKey: text('idempotency_key'),
}, (t) => [
    index('profile_interaction_events_profile_occurred_idx').on(t.profileId, t.occurredAt),
    index('profile_interaction_events_profile_event_idx').on(t.profileId, t.eventType),
    index('profile_interaction_events_profile_media_idx').on(t.profileId, t.mediaId),
    index('profile_interaction_events_session_idx').on(t.sessionId),
    index('profile_interaction_events_occurred_at_idx').on(t.occurredAt),
    uniqueIndex('profile_interaction_events_idempotency_key_unique')
        .on(t.idempotencyKey)
        .where(sql `${t.idempotencyKey} IS NOT NULL`),
]);
//# sourceMappingURL=profile-interaction-events.js.map