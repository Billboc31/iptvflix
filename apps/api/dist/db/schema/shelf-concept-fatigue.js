import { pgTable, uuid, integer, text, timestamp, uniqueIndex, } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
import { shelfConcepts } from './shelf-concepts.js';
export const shelfConceptFatigue = pgTable('shelf_concept_fatigue', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    shelfConceptId: uuid('shelf_concept_id')
        .notNull()
        .references(() => shelfConcepts.id, { onDelete: 'cascade' }),
    impressionCount: integer('impression_count').notNull().default(0),
    visibleImpressionCount: integer('visible_impression_count').notNull().default(0),
    zeroInteractionStreakCount: integer('zero_interaction_streak_count').notNull().default(0),
    lastShownAt: timestamp('last_shown_at', { withTimezone: true }),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    suppressionReason: text('suppression_reason'),
    suppressionVersion: text('suppression_version'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    uniqueIndex('shelf_concept_fatigue_profile_concept_idx').on(t.profileId, t.shelfConceptId),
]);
//# sourceMappingURL=shelf-concept-fatigue.js.map