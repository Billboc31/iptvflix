import { eq, and, inArray, sql } from 'drizzle-orm';
import { shelfConceptFatigue } from '../db/schema/index.js';
import { FATIGUE_MAX_ZERO_INTERACTION_STREAK, FATIGUE_COOLDOWN_DAYS, FATIGUE_SUPPRESSION_VERSION, FATIGUE_LOOKBACK_DAYS, } from '../config/env.js';
export class ShelfFatigueService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getFatigueStates(profileId, conceptIds) {
        if (conceptIds.length === 0)
            return new Map();
        const rows = await this.db
            .select()
            .from(shelfConceptFatigue)
            .where(and(eq(shelfConceptFatigue.profileId, profileId), inArray(shelfConceptFatigue.shelfConceptId, conceptIds)));
        return new Map(rows.map((r) => [
            r.shelfConceptId,
            {
                shelfConceptId: r.shelfConceptId,
                impressionCount: r.impressionCount,
                visibleImpressionCount: r.visibleImpressionCount,
                zeroInteractionStreakCount: r.zeroInteractionStreakCount,
                lastShownAt: r.lastShownAt?.toISOString() ?? null,
                cooldownUntil: r.cooldownUntil?.toISOString() ?? null,
                suppressionReason: r.suppressionReason,
                suppressionVersion: r.suppressionVersion,
                updatedAt: r.updatedAt.toISOString(),
            },
        ]));
    }
    async recordImpression(profileId, shelfConceptId, wasVisible) {
        const now = new Date();
        const lookbackCutoff = new Date(now.getTime() - FATIGUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
        await this.db
            .insert(shelfConceptFatigue)
            .values({
            profileId,
            shelfConceptId,
            impressionCount: 1,
            visibleImpressionCount: wasVisible ? 1 : 0,
            zeroInteractionStreakCount: wasVisible ? 1 : 0,
            lastShownAt: now,
            updatedAt: now,
        })
            .onConflictDoUpdate({
            target: [shelfConceptFatigue.profileId, shelfConceptFatigue.shelfConceptId],
            set: {
                impressionCount: sql `${shelfConceptFatigue.impressionCount} + 1`,
                visibleImpressionCount: wasVisible
                    ? sql `${shelfConceptFatigue.visibleImpressionCount} + 1`
                    : shelfConceptFatigue.visibleImpressionCount,
                // Reset streak if last impression was outside the lookback window; prevents stale history from triggering cooldown
                zeroInteractionStreakCount: wasVisible
                    ? sql `CASE WHEN ${shelfConceptFatigue.lastShownAt} IS NULL OR ${shelfConceptFatigue.lastShownAt} < ${lookbackCutoff.toISOString()}::timestamptz THEN 1 ELSE ${shelfConceptFatigue.zeroInteractionStreakCount} + 1 END`
                    : shelfConceptFatigue.zeroInteractionStreakCount,
                lastShownAt: now,
                updatedAt: now,
            },
        });
        if (!wasVisible)
            return;
        const [row] = await this.db
            .select({
            zeroInteractionStreakCount: shelfConceptFatigue.zeroInteractionStreakCount,
            cooldownUntil: shelfConceptFatigue.cooldownUntil,
        })
            .from(shelfConceptFatigue)
            .where(and(eq(shelfConceptFatigue.profileId, profileId), eq(shelfConceptFatigue.shelfConceptId, shelfConceptId)))
            .limit(1);
        if (row &&
            row.zeroInteractionStreakCount >= FATIGUE_MAX_ZERO_INTERACTION_STREAK &&
            !row.cooldownUntil) {
            const cooldownUntil = new Date(now.getTime() + FATIGUE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
            await this.db
                .update(shelfConceptFatigue)
                .set({
                cooldownUntil,
                suppressionReason: 'zero_interaction_streak',
                suppressionVersion: FATIGUE_SUPPRESSION_VERSION,
                updatedAt: now,
            })
                .where(and(eq(shelfConceptFatigue.profileId, profileId), eq(shelfConceptFatigue.shelfConceptId, shelfConceptId)));
        }
    }
    async recordInteraction(profileId, shelfConceptId) {
        const now = new Date();
        await this.db
            .update(shelfConceptFatigue)
            .set({ zeroInteractionStreakCount: 0, updatedAt: now })
            .where(and(eq(shelfConceptFatigue.profileId, profileId), eq(shelfConceptFatigue.shelfConceptId, shelfConceptId)));
    }
    async suppressConcept(profileId, shelfConceptId, reason, version, cooldownUntil) {
        const now = new Date();
        await this.db
            .insert(shelfConceptFatigue)
            .values({
            profileId,
            shelfConceptId,
            impressionCount: 0,
            suppressionReason: reason,
            suppressionVersion: version,
            cooldownUntil,
            updatedAt: now,
        })
            .onConflictDoUpdate({
            target: [shelfConceptFatigue.profileId, shelfConceptFatigue.shelfConceptId],
            set: {
                suppressionReason: reason,
                suppressionVersion: version,
                cooldownUntil,
                updatedAt: now,
            },
        });
    }
}
//# sourceMappingURL=shelf-fatigue-service.js.map