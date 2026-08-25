import { eq, and, isNull, asc, count, inArray, sql, desc, gte, or, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { shelfInstances, shelfInstanceItems, recommendationSeriesSessions, shelfConcepts, series, mediaVideos, viewingProgress, episodes, } from '../db/schema/index.js';
import { SERIES_BATCH_SIZE, SERIES_FRESH_DAYS, SERIES_ITEMS_MAX, SERIES_ITEMS_PER_SHELF, SERIES_SESSION_TTL_HOURS, } from '../config/env.js';
import { ShelfInstanceService } from './shelf-instance-service.js';
import { ShelfFatigueService } from './shelf-fatigue-service.js';
import { rankRecommendations } from './recommendation-ranking-service.js';
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js';
import { resolveMediaImageUrl } from '../lib/tmdb-image.js';
const MODEL_VERSION = 'v1';
const EXHAUSTED_MARKER = 'exhausted';
const IN_PROGRESS_MIN_SECONDS = 60;
// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------
export async function getOrCreateSeriesSession(profileId) {
    const now = new Date();
    const existing = await db
        .select()
        .from(recommendationSeriesSessions)
        .where(and(eq(recommendationSeriesSessions.profileId, profileId), sql `${recommendationSeriesSessions.expiresAt} > ${now.toISOString()}::timestamptz`))
        .orderBy(desc(recommendationSeriesSessions.startedAt))
        .limit(1);
    if (existing.length > 0) {
        const s = existing[0];
        return { id: s.id, profileId: s.profileId, cursorReference: s.cursorReference };
    }
    const expiresAt = new Date(now.getTime() + SERIES_SESSION_TTL_HOURS * 60 * 60 * 1000);
    const [inserted] = await db
        .insert(recommendationSeriesSessions)
        .values({ profileId, expiresAt, modelVersion: MODEL_VERSION })
        .returning();
    return { id: inserted.id, profileId: inserted.profileId, cursorReference: null };
}
// ---------------------------------------------------------------------------
// Pool queries
// ---------------------------------------------------------------------------
export async function countUnservedSeries(sessionId) {
    const [row] = await db
        .select({ n: count() })
        .from(shelfInstances)
        .where(and(eq(shelfInstances.seriesSessionId, sessionId), isNull(shelfInstances.servedAt)));
    return Number(row?.n ?? 0);
}
/** Next verticalPosition for pagination (first unserved shelf, or append after max). */
export async function resolveSeriesNextServePosition(sessionId) {
    const [unservedRow] = await db
        .select({ minPos: sql `MIN(${shelfInstances.verticalPosition})` })
        .from(shelfInstances)
        .where(and(eq(shelfInstances.seriesSessionId, sessionId), isNull(shelfInstances.servedAt)));
    if (unservedRow?.minPos != null)
        return Number(unservedRow.minPos);
    const [maxRow] = await db
        .select({ maxPos: sql `COALESCE(MAX(${shelfInstances.verticalPosition}), -1)` })
        .from(shelfInstances)
        .where(eq(shelfInstances.seriesSessionId, sessionId));
    return Number(maxRow?.maxPos ?? -1) + 1;
}
/** Append position after the highest existing shelf in the session. */
export async function resolveSeriesAppendPosition(sessionId) {
    const [maxRow] = await db
        .select({ maxPos: sql `COALESCE(MAX(${shelfInstances.verticalPosition}), -1)` })
        .from(shelfInstances)
        .where(eq(shelfInstances.seriesSessionId, sessionId));
    return Number(maxRow?.maxPos ?? -1) + 1;
}
export async function serveSeriesBatch(sessionId, nextPosition, batchSize = SERIES_BATCH_SIZE) {
    const rows = await db
        .select()
        .from(shelfInstances)
        .where(and(eq(shelfInstances.seriesSessionId, sessionId), isNull(shelfInstances.servedAt), sql `${shelfInstances.verticalPosition} >= ${nextPosition}`))
        .orderBy(asc(shelfInstances.verticalPosition))
        .limit(batchSize);
    if (rows.length === 0) {
        return { shelves: [], newNextPosition: nextPosition, hasMore: false };
    }
    const ids = rows.map((r) => r.id);
    const now = new Date();
    await db
        .update(shelfInstances)
        .set({ servedAt: now })
        .where(inArray(shelfInstances.id, ids));
    const itemRows = await db
        .select()
        .from(shelfInstanceItems)
        .where(inArray(shelfInstanceItems.shelfInstanceId, ids))
        .orderBy(asc(shelfInstanceItems.rankPosition));
    const itemsByInstance = new Map();
    for (const item of itemRows) {
        const list = itemsByInstance.get(item.shelfInstanceId) ?? [];
        list.push(item);
        itemsByInstance.set(item.shelfInstanceId, list);
    }
    const shelves = rows.map((r) => ({
        instanceId: r.id,
        title: r.title,
        verticalPosition: r.verticalPosition ?? 0,
        items: (itemsByInstance.get(r.id) ?? []).map((i) => ({ mediaType: i.mediaType, mediaId: i.mediaId })),
    }));
    const lastPosition = rows[rows.length - 1].verticalPosition ?? 0;
    const newNextPosition = lastPosition + 1;
    const remaining = await countUnservedSeries(sessionId);
    return { shelves, newNextPosition, hasMore: remaining > 0 };
}
// ---------------------------------------------------------------------------
// Pool filling
// ---------------------------------------------------------------------------
export function fillSeriesPool(sessionId, profileId, targetCount) {
    _fillSeriesPoolAsync(sessionId, profileId, targetCount).catch((err) => {
        console.error('[series-pool] fillSeriesPool error (swallowed):', err);
    });
}
export async function fillSeriesPoolAsync(sessionId, profileId, targetCount) {
    return _fillSeriesPoolAsync(sessionId, profileId, targetCount);
}
async function _fillSeriesPoolAsync(sessionId, profileId, targetCount) {
    console.log(`[SERIES_GENERATION] pool fill triggered sessionId=${sessionId}`);
    const servedItems = await db
        .select({ mediaId: shelfInstanceItems.mediaId })
        .from(shelfInstanceItems)
        .innerJoin(shelfInstances, eq(shelfInstances.id, shelfInstanceItems.shelfInstanceId))
        .where(eq(shelfInstances.seriesSessionId, sessionId));
    const excludedMediaIds = new Set(servedItems.map((r) => r.mediaId));
    const sessionConceptRows = await db
        .select({ shelfConceptId: shelfInstances.shelfConceptId })
        .from(shelfInstances)
        .where(and(eq(shelfInstances.seriesSessionId, sessionId), sql `${shelfInstances.shelfConceptId} IS NOT NULL`));
    const usedConceptIds = new Set(sessionConceptRows.map((r) => r.shelfConceptId).filter((id) => id !== null));
    const conceptRows = await db
        .select()
        .from(shelfConcepts)
        .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true)))
        .orderBy(desc(shelfConcepts.createdAt))
        .limit(targetCount * 3);
    const candidateConcepts = conceptRows.filter((c) => {
        if (usedConceptIds.has(c.id))
            return false;
        const types = c.desiredMediaTypes ?? [];
        return types.length === 0 || types.includes('SERIES');
    });
    const fatigueService = new ShelfFatigueService(db);
    const fatigueStates = await fatigueService.getFatigueStates(profileId, candidateConcepts.map((c) => c.id));
    const now = Date.now();
    const eligibleConcepts = candidateConcepts.filter((c) => {
        const state = fatigueStates.get(c.id);
        if (!state)
            return true;
        if (state.cooldownUntil && new Date(state.cooldownUntil).getTime() > now)
            return false;
        return true;
    });
    const [maxPosRow] = await db
        .select({ maxPos: sql `COALESCE(MAX(${shelfInstances.verticalPosition}), -1)` })
        .from(shelfInstances)
        .where(eq(shelfInstances.seriesSessionId, sessionId));
    let nextPosition = (maxPosRow?.maxPos ?? -1) + 1;
    const shelfInstanceService = new ShelfInstanceService(db);
    let generated = 0;
    for (const concept of eligibleConcepts) {
        if (generated >= targetCount)
            break;
        try {
            const requestLimit = Math.min(SERIES_ITEMS_PER_SHELF + excludedMediaIds.size + 10, SERIES_ITEMS_MAX);
            const t0 = Date.now();
            let candidates;
            let queryPlannerVersion = MODEL_VERSION;
            let embeddingModelVersion = 'none';
            let rankerVersion = MODEL_VERSION;
            let totalCandidateCount = 0;
            const engineResult = await RecommendationEngineClient.queryForShelf({
                text: concept.semanticIntent,
                profileId,
                limit: requestLimit,
                mediaTypeFilter: 'SERIES',
            });
            if (engineResult) {
                let pool = engineResult.candidates
                    .filter((c) => c.mediaType === 'SERIES')
                    .filter((c) => !excludedMediaIds.has(c.mediaId));
                if (concept.freshnessPolicy === 'AVAILABLE_NOW') {
                    pool = pool.filter((c) => c.available);
                }
                if (concept.freshnessPolicy === 'NEW_RELEASES') {
                    const cutoff = new Date(Date.now() - SERIES_FRESH_DAYS * 24 * 60 * 60 * 1000);
                    const freshIds = await getFreshSeriesIds(pool.map((c) => c.mediaId), cutoff);
                    pool = pool.filter((c) => freshIds.has(c.mediaId));
                }
                candidates = pool.slice(0, SERIES_ITEMS_PER_SHELF);
                queryPlannerVersion = engineResult.queryPlannerVersion;
                embeddingModelVersion = engineResult.embeddingModelVersion;
                rankerVersion = engineResult.rankerVersion;
                totalCandidateCount = engineResult.candidateCount;
            }
            else {
                const recResult = await rankRecommendations(profileId, {
                    limit: requestLimit,
                    mediaType: 'SERIES',
                    includeSeen: false,
                });
                let pool = recResult.candidates
                    .filter((c) => c.mediaType === 'SERIES')
                    .filter((c) => !excludedMediaIds.has(c.mediaId));
                if (concept.freshnessPolicy === 'AVAILABLE_NOW') {
                    pool = pool.filter((c) => c.available);
                }
                if (concept.freshnessPolicy === 'NEW_RELEASES') {
                    const cutoff = new Date(Date.now() - SERIES_FRESH_DAYS * 24 * 60 * 60 * 1000);
                    const freshIds = await getFreshSeriesIds(pool.map((c) => c.mediaId), cutoff);
                    pool = pool.filter((c) => freshIds.has(c.mediaId));
                }
                candidates = pool.slice(0, SERIES_ITEMS_PER_SHELF).map((c) => ({
                    mediaId: c.mediaId,
                    mediaType: c.mediaType,
                    semanticScore: 0,
                    profileScore: c.score ?? 0,
                    finalScore: c.score ?? 0,
                    reasons: c.reasons ?? [],
                    available: c.available ?? false,
                    qualityPrior: c.scoreBreakdown?.qualityPrior ?? 0,
                    languageAffinity: c.scoreBreakdown?.languageAffinity ?? 0,
                }));
                totalCandidateCount = recResult.candidates.length;
            }
            if (candidates.length === 0)
                continue;
            const instanceId = await shelfInstanceService.persistShelfInstance({
                profileId,
                shelfConceptId: concept.id,
                title: concept.title,
                semanticIntentSnapshot: concept.semanticIntent,
                generationType: concept.generationType,
                generationReasonCodes: concept.reasonCodes ?? [],
                seriesSessionId: sessionId,
                verticalPosition: nextPosition,
                rankerVersion,
                queryPlannerVersion,
                embeddingModelVersion,
                candidateCount: totalCandidateCount,
                latencyMs: Date.now() - t0,
                cacheHit: false,
                items: candidates.map((c, i) => ({
                    mediaType: c.mediaType,
                    mediaId: c.mediaId,
                    rankPosition: i,
                    semanticScore: c.semanticScore,
                    profileScore: c.profileScore,
                    finalScore: c.finalScore,
                    reasonCodes: c.reasons,
                    availabilityStatus: c.available ? 'available' : 'upcoming',
                    wasEligibleAtGeneration: true,
                })),
            });
            for (const c of candidates)
                excludedMediaIds.add(c.mediaId);
            usedConceptIds.add(concept.id);
            nextPosition++;
            generated++;
            console.log(`[series-pool] generated shelf ${instanceId} (pos=${nextPosition - 1}) for session ${sessionId}`);
        }
        catch (err) {
            console.error('[series-pool] shelf generation error (concept skipped):', err);
        }
    }
    if (generated === 0 && eligibleConcepts.length === 0) {
        await db
            .update(recommendationSeriesSessions)
            .set({ cursorReference: EXHAUSTED_MARKER })
            .where(eq(recommendationSeriesSessions.id, sessionId));
        console.log(`[series-pool] session ${sessionId} marked exhausted`);
    }
}
// ---------------------------------------------------------------------------
// Freshness helpers
// ---------------------------------------------------------------------------
async function getFreshSeriesIds(seriesIds, cutoffDate) {
    if (seriesIds.length === 0)
        return new Set();
    const rows = await db
        .select({ id: series.id })
        .from(series)
        .where(and(inArray(series.id, seriesIds), gte(series.createdAt, cutoffDate)));
    return new Set(rows.map((r) => r.id));
}
// ---------------------------------------------------------------------------
// In-progress series exclusion
// ---------------------------------------------------------------------------
async function getInProgressSeriesIds(profileId) {
    try {
        const rows = await db
            .select({ seriesId: episodes.seriesId })
            .from(viewingProgress)
            .innerJoin(episodes, eq(episodes.id, viewingProgress.mediaId))
            .where(and(eq(viewingProgress.profileId, profileId), eq(viewingProgress.mediaType, 'EPISODE'), gt(viewingProgress.progressSeconds, IN_PROGRESS_MIN_SECONDS)));
        return new Set(rows.map((r) => r.seriesId));
    }
    catch {
        return new Set();
    }
}
// ---------------------------------------------------------------------------
// Enrichment map for declared rails
// ---------------------------------------------------------------------------
async function buildSeriesEnrichmentMap(seriesIds) {
    if (seriesIds.length === 0)
        return new Map();
    const [seriesRows, trailerRows] = await Promise.all([
        db.select({ id: series.id, title: series.title, posterPath: series.posterPath })
            .from(series)
            .where(inArray(series.id, seriesIds)),
        db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
            .from(mediaVideos)
            .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds))),
    ]);
    const result = new Map();
    for (const r of seriesRows) {
        result.set(r.id, { title: r.title, posterUrl: resolveMediaImageUrl(r.posterPath), trailerKey: null });
    }
    for (const r of trailerRows) {
        const entry = result.get(r.mediaId);
        if (entry && !entry.trailerKey)
            entry.trailerKey = r.youtubeKey;
    }
    return result;
}
// ---------------------------------------------------------------------------
// Thematic concept selection
// ---------------------------------------------------------------------------
async function selectExploitationConcept(profileId, sessionId, fatigueService, usedConceptIds) {
    const conceptRows = await db
        .select()
        .from(shelfConcepts)
        .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true), or(eq(shelfConcepts.generationType, 'PERSONALIZED'), eq(shelfConcepts.generationType, 'EDITORIAL'), eq(shelfConcepts.generationType, 'DISCOVERY'))))
        .orderBy(desc(shelfConcepts.createdAt))
        .limit(30);
    const candidates = conceptRows.filter((c) => {
        if (usedConceptIds.has(c.id))
            return false;
        const types = c.desiredMediaTypes ?? [];
        return types.length === 0 || types.includes('SERIES');
    });
    const fatigueStates = await fatigueService.getFatigueStates(profileId, candidates.map((c) => c.id));
    const nowMs = Date.now();
    for (const concept of candidates) {
        const state = fatigueStates.get(concept.id);
        if (state?.cooldownUntil && new Date(state.cooldownUntil).getTime() > nowMs)
            continue;
        return concept;
    }
    return null;
}
async function selectExplorationConcept(profileId, fatigueService, usedConceptIds) {
    const conceptRows = await db
        .select()
        .from(shelfConcepts)
        .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true), eq(shelfConcepts.generationType, 'EXPLORATION')))
        .orderBy(desc(shelfConcepts.createdAt))
        .limit(10);
    const candidates = conceptRows.filter((c) => {
        if (usedConceptIds.has(c.id))
            return false;
        const types = c.desiredMediaTypes ?? [];
        return types.length === 0 || types.includes('SERIES');
    });
    const fatigueStates = await fatigueService.getFatigueStates(profileId, candidates.map((c) => c.id));
    const nowMs = Date.now();
    for (const concept of candidates) {
        const state = fatigueStates.get(concept.id);
        if (state?.cooldownUntil && new Date(state.cooldownUntil).getTime() > nowMs)
            continue;
        return concept;
    }
    return null;
}
export async function buildSeriesDeclaredRails(profileId, sessionId, startPosition = 0) {
    console.log(`[SERIES_GENERATION] expensive LLM/semantic generation triggered profileId=${profileId}`);
    const inProgressIds = await getInProgressSeriesIds(profileId);
    const excludedMediaIds = new Set(inProgressIds);
    const shelfInstanceService = new ShelfInstanceService(db);
    const fatigueService = new ShelfFatigueService(db);
    const usedConceptIds = new Set();
    const servedAt = new Date();
    let nextPosition = startPosition;
    const results = [];
    const pendingRails = [];
    async function queryCandidates(params) {
        const requestLimit = Math.min(SERIES_ITEMS_PER_SHELF + excludedMediaIds.size + 10, SERIES_ITEMS_MAX);
        const engineResult = await RecommendationEngineClient.queryForShelf({
            text: params.text,
            profileId,
            limit: requestLimit,
            mediaTypeFilter: params.mediaTypeFilter,
            freshnessBoostDays: params.freshnessBoostDays,
        });
        if (engineResult) {
            const pool = engineResult.candidates
                .filter((c) => c.mediaType === 'SERIES')
                .filter((c) => !excludedMediaIds.has(c.mediaId));
            return {
                candidates: pool.slice(0, SERIES_ITEMS_PER_SHELF),
                queryPlannerVersion: engineResult.queryPlannerVersion,
                embeddingModelVersion: engineResult.embeddingModelVersion,
                rankerVersion: engineResult.rankerVersion,
                candidateCount: engineResult.candidateCount,
            };
        }
        const recResult = await rankRecommendations(profileId, {
            limit: requestLimit,
            mediaType: 'SERIES',
            includeSeen: false,
        });
        const pool = recResult.candidates
            .filter((c) => c.mediaType === 'SERIES')
            .filter((c) => !excludedMediaIds.has(c.mediaId));
        return {
            candidates: pool.slice(0, SERIES_ITEMS_PER_SHELF).map((c) => ({
                mediaId: c.mediaId,
                mediaType: c.mediaType,
                semanticScore: 0,
                profileScore: c.score ?? 0,
                finalScore: c.score ?? 0,
                reasons: c.reasons ?? [],
                available: c.available ?? false,
                qualityPrior: 0,
                languageAffinity: 0,
            })),
            queryPlannerVersion: MODEL_VERSION,
            embeddingModelVersion: 'none',
            rankerVersion: MODEL_VERSION,
            candidateCount: recResult.candidates.length,
        };
    }
    // ── Rail 1: "Séries pour toi" ───────────────────────────────────────────────
    try {
        const t0 = Date.now();
        const { candidates, ...meta } = await queryCandidates({ text: 'séries recommandées pour ce profil', mediaTypeFilter: 'SERIES' });
        if (candidates.length > 0) {
            pendingRails.push({ title: 'Séries pour toi', candidates, conceptId: null, semanticIntent: null, generationType: 'SYSTEM_DECLARED', ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ });
            for (const c of candidates)
                excludedMediaIds.add(c.mediaId);
        }
    }
    catch (err) {
        console.error('[series-pool] declared rail 1 "Séries pour toi" failed:', err);
    }
    // ── Rail 2: "Nouvelles séries pour toi" ────────────────────────────────────
    try {
        const t0 = Date.now();
        const cutoff = new Date(Date.now() - SERIES_FRESH_DAYS * 24 * 60 * 60 * 1000);
        const { candidates: raw, ...meta } = await queryCandidates({ text: 'nouvelles séries sorties récemment', mediaTypeFilter: 'SERIES', freshnessBoostDays: SERIES_FRESH_DAYS });
        const freshIds = await getFreshSeriesIds(raw.map((c) => c.mediaId), cutoff);
        const candidates = raw.filter((c) => freshIds.has(c.mediaId));
        if (candidates.length > 0) {
            pendingRails.push({ title: 'Nouvelles séries pour toi', candidates, conceptId: null, semanticIntent: null, generationType: 'SYSTEM_DECLARED', ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ });
            for (const c of candidates)
                excludedMediaIds.add(c.mediaId);
        }
    }
    catch (err) {
        console.error('[series-pool] declared rail 2 "Nouvelles séries pour toi" failed:', err);
    }
    // ── Rails 3 & 4: Exploitation thematic shelves ─────────────────────────────
    for (let i = 0; i < 2; i++) {
        try {
            const t0 = Date.now();
            const concept = await selectExploitationConcept(profileId, sessionId, fatigueService, usedConceptIds);
            if (concept) {
                const { candidates, ...meta } = await queryCandidates({ text: concept.semanticIntent, mediaTypeFilter: 'SERIES' });
                if (candidates.length > 0) {
                    usedConceptIds.add(concept.id);
                    pendingRails.push({ title: concept.title, candidates, conceptId: concept.id, semanticIntent: concept.semanticIntent, generationType: concept.generationType, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ });
                    for (const c of candidates)
                        excludedMediaIds.add(c.mediaId);
                }
            }
        }
        catch (err) {
            console.error(`[series-pool] declared rail exploitation thematic ${i + 3} failed:`, err);
        }
    }
    // ── Rail 5+: Exploration shelf ─────────────────────────────────────────────
    try {
        const t0 = Date.now();
        const concept = await selectExplorationConcept(profileId, fatigueService, usedConceptIds);
        if (concept) {
            const { candidates, ...meta } = await queryCandidates({ text: concept.semanticIntent, mediaTypeFilter: 'SERIES' });
            if (candidates.length >= SERIES_ITEMS_PER_SHELF / 4) {
                usedConceptIds.add(concept.id);
                pendingRails.push({ title: concept.title, candidates, conceptId: concept.id, semanticIntent: concept.semanticIntent, generationType: 'EXPLORATION', ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ });
                for (const c of candidates)
                    excludedMediaIds.add(c.mediaId);
            }
        }
    }
    catch (err) {
        console.error('[series-pool] declared rail exploration failed:', err);
    }
    if (pendingRails.length === 0)
        return { shelves: results, nextPoolPosition: nextPosition, shelfInstanceIds: [] };
    // ── Batch enrich all series items in one round-trip ────────────────────────
    const allSeriesIds = pendingRails.flatMap((r) => r.candidates.map((c) => c.mediaId));
    const enrichmentMap = await buildSeriesEnrichmentMap(allSeriesIds);
    // ── Persist + assemble ShelfResponse for each pending rail ─────────────────
    const shelfInstanceIds = [];
    for (const rail of pendingRails) {
        try {
            const instanceId = await shelfInstanceService.persistShelfInstance({
                profileId,
                shelfConceptId: rail.conceptId,
                title: rail.title,
                semanticIntentSnapshot: rail.semanticIntent,
                generationType: rail.generationType,
                generationReasonCodes: [],
                seriesSessionId: sessionId,
                verticalPosition: rail.verticalPosition,
                rankerVersion: rail.rankerVersion,
                queryPlannerVersion: rail.queryPlannerVersion,
                embeddingModelVersion: rail.embeddingModelVersion,
                candidateCount: rail.candidateCount,
                latencyMs: rail.latencyMs,
                cacheHit: false,
                servedAt,
                items: rail.candidates.map((c, i) => ({
                    mediaType: c.mediaType,
                    mediaId: c.mediaId,
                    rankPosition: i,
                    semanticScore: c.semanticScore,
                    profileScore: c.profileScore,
                    finalScore: c.finalScore,
                    reasonCodes: c.reasons,
                    availabilityStatus: c.available ? 'available' : 'upcoming',
                    wasEligibleAtGeneration: true,
                })),
            });
            shelfInstanceIds.push(instanceId);
            results.push({
                id: instanceId,
                title: rail.title,
                type: 'GENERATED',
                layoutHint: 'ROW',
                shelfInstanceId: instanceId,
                items: rail.candidates.map((c) => ({
                    mediaType: c.mediaType,
                    mediaId: c.mediaId,
                    title: enrichmentMap.get(c.mediaId)?.title ?? '',
                    posterUrl: enrichmentMap.get(c.mediaId)?.posterUrl ?? null,
                    trailerKey: enrichmentMap.get(c.mediaId)?.trailerKey ?? null,
                })),
            });
        }
        catch (err) {
            console.error(`[series-pool] failed to persist declared rail "${rail.title}":`, err);
        }
    }
    return { shelves: results, nextPoolPosition: nextPosition, shelfInstanceIds };
}
// ---------------------------------------------------------------------------
// Fallback series shelf (when rec service unavailable)
// ---------------------------------------------------------------------------
export async function buildSeriesFallbackShelf() {
    const rows = await db
        .select({ id: series.id, title: series.title, posterPath: series.posterPath })
        .from(series)
        .orderBy(desc(series.voteAverage), desc(series.popularity))
        .limit(SERIES_ITEMS_PER_SHELF);
    const items = rows.map((r) => ({
        mediaType: 'SERIES',
        mediaId: r.id,
        title: r.title,
        posterUrl: resolveMediaImageUrl(r.posterPath),
    }));
    return {
        id: 'sys_fallback_series_popular',
        title: 'Séries populaires',
        type: 'SYSTEM',
        layoutHint: 'ROW',
        items,
    };
}
//# sourceMappingURL=series-pool-service.js.map