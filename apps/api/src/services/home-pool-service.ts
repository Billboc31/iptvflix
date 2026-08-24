import { eq, and, isNull, asc, count, inArray, notInArray, sql, desc, gte, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelfInstances,
  shelfInstanceItems,
  recommendationHomeSessions,
  shelfConcepts,
  movies,
  series,
  mediaVideos,
  movieAvailabilities,
} from '../db/schema/index.js'
import {
  HOME_BATCH_SIZE,
  HOME_FRESH_DAYS,
  HOME_ITEMS_MAX,
  HOME_ITEMS_PER_SHELF,
  HOME_POOL_TARGET,
  HOME_SESSION_TTL_HOURS,
} from '../config/env.js'
import { ShelfInstanceService } from './shelf-instance-service.js'
import { ShelfFatigueService } from './shelf-fatigue-service.js'
import { rankRecommendations } from './recommendation-ranking-service.js'
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js'
import type { ShelfCandidateItem } from '../client/recommendation-engine-client.js'
import { getShelf } from './shelf-service.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { selectHero } from './hero-selector.js'
import type { ShelfResponse, ShelfItem, HeroItem } from '@iptvflix/api-contracts'

const MODEL_VERSION = 'v1'
const EXHAUSTED_MARKER = 'exhausted'

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function getOrCreateSession(profileId: string): Promise<{ id: string; profileId: string; cursorReference: string | null }> {
  const now = new Date()
  const existing = await db
    .select()
    .from(recommendationHomeSessions)
    .where(
      and(
        eq(recommendationHomeSessions.profileId, profileId),
        sql`${recommendationHomeSessions.expiresAt} > ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(recommendationHomeSessions.startedAt))
    .limit(1)

  if (existing.length > 0) {
    const s = existing[0]
    return { id: s.id, profileId: s.profileId, cursorReference: s.cursorReference }
  }

  const expiresAt = new Date(now.getTime() + HOME_SESSION_TTL_HOURS * 60 * 60 * 1000)
  const [inserted] = await db
    .insert(recommendationHomeSessions)
    .values({ profileId, expiresAt, modelVersion: MODEL_VERSION })
    .returning()

  return { id: inserted.id, profileId: inserted.profileId, cursorReference: null }
}

// ---------------------------------------------------------------------------
// Pool queries
// ---------------------------------------------------------------------------

export async function countUnserved(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(shelfInstances)
    .where(and(eq(shelfInstances.homeSessionId, sessionId), isNull(shelfInstances.servedAt)))
  return Number(row?.n ?? 0)
}

export async function serveBatch(
  sessionId: string,
  nextPosition: number,
  batchSize: number = HOME_BATCH_SIZE,
): Promise<{ shelves: Array<{ instanceId: string; title: string; verticalPosition: number; items: Array<{ mediaType: string; mediaId: string }> }>; newNextPosition: number; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(shelfInstances)
    .where(
      and(
        eq(shelfInstances.homeSessionId, sessionId),
        isNull(shelfInstances.servedAt),
        sql`${shelfInstances.verticalPosition} >= ${nextPosition}`,
      ),
    )
    .orderBy(asc(shelfInstances.verticalPosition))
    .limit(batchSize)

  if (rows.length === 0) {
    return { shelves: [], newNextPosition: nextPosition, hasMore: false }
  }

  const ids = rows.map((r) => r.id)
  const now = new Date()
  await db
    .update(shelfInstances)
    .set({ servedAt: now })
    .where(inArray(shelfInstances.id, ids))

  const itemRows = await db
    .select()
    .from(shelfInstanceItems)
    .where(inArray(shelfInstanceItems.shelfInstanceId, ids))
    .orderBy(asc(shelfInstanceItems.rankPosition))

  const itemsByInstance = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsByInstance.get(item.shelfInstanceId) ?? []
    list.push(item)
    itemsByInstance.set(item.shelfInstanceId, list)
  }

  const shelves = rows.map((r) => ({
    instanceId: r.id,
    title: r.title,
    verticalPosition: r.verticalPosition ?? 0,
    items: (itemsByInstance.get(r.id) ?? []).map((i) => ({ mediaType: i.mediaType, mediaId: i.mediaId })),
  }))

  const lastPosition = rows[rows.length - 1].verticalPosition ?? 0
  const newNextPosition = lastPosition + 1

  const remaining = await countUnserved(sessionId)
  const hasMore = remaining > 0

  return { shelves, newNextPosition, hasMore }
}

// ---------------------------------------------------------------------------
// Fixed shelves
// ---------------------------------------------------------------------------

export async function buildFixedShelves(profileId: string): Promise<ShelfResponse[]> {
  const [continueWatching, myList] = await Promise.all([
    getShelf('sys_continue_watching', profileId),
    getShelf('sys_my_list', profileId),
  ])
  const fixed: ShelfResponse[] = []
  if (continueWatching.items.length > 0) fixed.push(continueWatching)
  if (myList.items.length > 0) fixed.push(myList)
  return fixed
}

// ---------------------------------------------------------------------------
// Pool filling
// ---------------------------------------------------------------------------

export function fillPool(sessionId: string, profileId: string, targetCount: number): void {
  _fillPoolAsync(sessionId, profileId, targetCount).catch((err) => {
    console.error('[home-pool] fillPool error (swallowed):', err)
  })
}

export async function fillPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void> {
  return _fillPoolAsync(sessionId, profileId, targetCount)
}

async function _fillPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void> {
  console.log(`[HOME_GENERATION] pool fill triggered sessionId=${sessionId}`)
  // Gather already-served media IDs in this session for cross-shelf dedup.
  const servedItems = await db
    .select({ mediaId: shelfInstanceItems.mediaId })
    .from(shelfInstanceItems)
    .innerJoin(shelfInstances, eq(shelfInstances.id, shelfInstanceItems.shelfInstanceId))
    .where(eq(shelfInstances.homeSessionId, sessionId))

  const excludedMediaIds = new Set(servedItems.map((r) => r.mediaId))

  // Gather concept IDs already in this session.
  const sessionConceptRows = await db
    .select({ shelfConceptId: shelfInstances.shelfConceptId })
    .from(shelfInstances)
    .where(and(eq(shelfInstances.homeSessionId, sessionId), sql`${shelfInstances.shelfConceptId} IS NOT NULL`))

  const usedConceptIds = new Set(
    sessionConceptRows.map((r) => r.shelfConceptId).filter((id): id is string => id !== null),
  )

  // Load candidate concepts.
  const conceptRows = await db
    .select()
    .from(shelfConcepts)
    .where(
      and(
        eq(shelfConcepts.profileId, profileId),
        eq(shelfConcepts.active, true),
      ),
    )
    .orderBy(desc(shelfConcepts.createdAt))
    .limit(targetCount * 3)

  // Filter out already-used concepts.
  const candidateConcepts = conceptRows.filter((c) => !usedConceptIds.has(c.id))

  // Filter out concepts in fatigue cooldown.
  const fatigueService = new ShelfFatigueService(db)
  const fatigueStates = await fatigueService.getFatigueStates(profileId, candidateConcepts.map((c) => c.id))
  const now = Date.now()
  const eligibleConcepts = candidateConcepts.filter((c) => {
    const state = fatigueStates.get(c.id)
    if (!state) return true
    if (state.cooldownUntil && new Date(state.cooldownUntil).getTime() > now) return false
    return true
  })

  // Determine next vertical position.
  const [maxPosRow] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${shelfInstances.verticalPosition}), -1)` })
    .from(shelfInstances)
    .where(eq(shelfInstances.homeSessionId, sessionId))

  let nextPosition = (maxPosRow?.maxPos ?? -1) + 1

  const shelfInstanceService = new ShelfInstanceService(db)
  let generated = 0

  for (const concept of eligibleConcepts) {
    if (generated >= targetCount) break

    try {
      // Request extra to compensate for items that will be excluded post-filter.
      const requestLimit = Math.min(HOME_ITEMS_PER_SHELF + excludedMediaIds.size + 10, HOME_ITEMS_MAX)
      const t0 = Date.now()

      let candidates: Array<{ mediaId: string; mediaType: string; semanticScore: number; profileScore: number; finalScore: number; reasons: string[]; available: boolean }>
      let queryPlannerVersion = MODEL_VERSION
      let embeddingModelVersion = 'none'
      let rankerVersion = MODEL_VERSION
      let totalCandidateCount = 0

      const engineResult = await RecommendationEngineClient.queryForShelf({
        text: concept.semanticIntent,
        profileId,
        limit: requestLimit,
      })

      if (engineResult) {
        // Engine returned semantic results — use them, applying freshness policy.
        let pool = engineResult.candidates.filter((c) => !excludedMediaIds.has(c.mediaId))

        if (concept.freshnessPolicy === 'AVAILABLE_NOW') {
          pool = pool.filter((c) => c.available)
        }

        if (concept.freshnessPolicy === 'NEW_RELEASES') {
          const cutoff = new Date(Date.now() - HOME_FRESH_DAYS * 24 * 60 * 60 * 1000)
          const freshIds = await getFreshMediaIds(pool.map((c) => ({ mediaId: c.mediaId, mediaType: c.mediaType })), cutoff)
          pool = pool.filter((c) => freshIds.has(c.mediaId))
        }

        candidates = pool.slice(0, HOME_ITEMS_PER_SHELF)
        queryPlannerVersion = engineResult.queryPlannerVersion
        embeddingModelVersion = engineResult.embeddingModelVersion
        rankerVersion = engineResult.rankerVersion
        totalCandidateCount = engineResult.candidateCount
      } else {
        // Engine unavailable — fall back to generic profile ranking.
        const recResult = await rankRecommendations(profileId, {
          limit: requestLimit,
          includeSeen: false,
        })
        let pool = recResult.candidates.filter((c) => !excludedMediaIds.has(c.mediaId))

        if (concept.freshnessPolicy === 'AVAILABLE_NOW') {
          pool = pool.filter((c) => c.available)
        }

        if (concept.freshnessPolicy === 'NEW_RELEASES') {
          const cutoff = new Date(Date.now() - HOME_FRESH_DAYS * 24 * 60 * 60 * 1000)
          const freshIds = await getFreshMediaIds(pool.map((c) => ({ mediaId: c.mediaId, mediaType: c.mediaType as 'MOVIE' | 'SERIES' })), cutoff)
          pool = pool.filter((c) => freshIds.has(c.mediaId))
        }

        candidates = pool.slice(0, HOME_ITEMS_PER_SHELF).map((c) => ({
          mediaId: c.mediaId,
          mediaType: c.mediaType,
          semanticScore: 0,
          profileScore: c.score ?? 0,
          finalScore: c.score ?? 0,
          reasons: c.reasons ?? [],
          available: c.available ?? false,
        }))
        totalCandidateCount = recResult.candidates.length
      }

      if (candidates.length === 0) continue

      const instanceId = await shelfInstanceService.persistShelfInstance({
        profileId,
        shelfConceptId: concept.id,
        title: concept.title,
        semanticIntentSnapshot: concept.semanticIntent,
        generationType: concept.generationType,
        generationReasonCodes: (concept.reasonCodes as string[]) ?? [],
        homeSessionId: sessionId,
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
      })

      // Add this shelf's items to the exclusion set for subsequent shelves.
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
      usedConceptIds.add(concept.id)
      nextPosition++
      generated++

      console.log(`[home-pool] generated shelf ${instanceId} (pos=${nextPosition - 1}) for session ${sessionId}`)
    } catch (err) {
      console.error('[home-pool] shelf generation error (concept skipped):', err)
    }
  }

  if (generated === 0 && eligibleConcepts.length === 0) {
    // No more eligible concepts — mark session exhausted.
    await db
      .update(recommendationHomeSessions)
      .set({ cursorReference: EXHAUSTED_MARKER })
      .where(eq(recommendationHomeSessions.id, sessionId))
    console.log(`[home-pool] session ${sessionId} marked exhausted`)
  }
}

// ---------------------------------------------------------------------------
// Declared rails helpers
// ---------------------------------------------------------------------------

async function getFreshMediaIds(
  items: Array<{ mediaId: string; mediaType: 'MOVIE' | 'SERIES' }>,
  cutoffDate: Date,
): Promise<Set<string>> {
  if (items.length === 0) return new Set()
  const movieIds = items.filter((i) => i.mediaType === 'MOVIE').map((i) => i.mediaId)
  const seriesIds = items.filter((i) => i.mediaType === 'SERIES').map((i) => i.mediaId)

  const [movieRows, seriesRows] = await Promise.all([
    movieIds.length > 0
      ? db.select({ id: movies.id }).from(movies).where(and(inArray(movies.id, movieIds), gte(movies.createdAt, cutoffDate)))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ id: series.id }).from(series).where(and(inArray(series.id, seriesIds), gte(series.createdAt, cutoffDate)))
      : Promise.resolve([]),
  ])

  const freshIds = new Set<string>()
  for (const r of [...movieRows, ...seriesRows]) freshIds.add(r.id)
  return freshIds
}

async function buildEnrichmentMap(
  items: Array<{ mediaId: string; mediaType: 'MOVIE' | 'SERIES' }>,
): Promise<Map<string, { title: string; posterUrl: string | null; trailerKey: string | null }>> {
  if (items.length === 0) return new Map()

  const movieIds = items.filter((i) => i.mediaType === 'MOVIE').map((i) => i.mediaId)
  const seriesIds = items.filter((i) => i.mediaType === 'SERIES').map((i) => i.mediaId)

  const [movieRows, seriesRows, movieTrailers, seriesTrailers] = await Promise.all([
    movieIds.length > 0
      ? db.select({ id: movies.id, title: movies.title, posterPath: movies.posterPath }).from(movies).where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ id: series.id, title: series.title, posterPath: series.posterPath }).from(series).where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey }).from(mediaVideos).where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds)))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey }).from(mediaVideos).where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
      : Promise.resolve([]),
  ])

  const result = new Map<string, { title: string; posterUrl: string | null; trailerKey: string | null }>()
  for (const r of movieRows) result.set(r.id, { title: r.title, posterUrl: resolveMediaImageUrl(r.posterPath), trailerKey: null })
  for (const r of seriesRows) result.set(r.id, { title: r.title, posterUrl: resolveMediaImageUrl(r.posterPath), trailerKey: null })
  for (const r of [...movieTrailers, ...seriesTrailers]) {
    const entry = result.get(r.mediaId)
    if (entry && !entry.trailerKey) entry.trailerKey = r.youtubeKey
  }
  return result
}

async function selectThematicConcept(
  profileId: string,
  sessionId: string,
  fatigueService: ShelfFatigueService,
): Promise<typeof shelfConcepts.$inferSelect | null> {
  const sessionConceptRows = await db
    .select({ shelfConceptId: shelfInstances.shelfConceptId })
    .from(shelfInstances)
    .where(and(eq(shelfInstances.homeSessionId, sessionId), sql`${shelfInstances.shelfConceptId} IS NOT NULL`))
  const usedConceptIds = new Set(
    sessionConceptRows.map((r) => r.shelfConceptId).filter((id): id is string => id !== null),
  )

  const conceptRows = await db
    .select()
    .from(shelfConcepts)
    .where(
      and(
        eq(shelfConcepts.profileId, profileId),
        eq(shelfConcepts.active, true),
        or(
          eq(shelfConcepts.generationType, 'PERSONALIZED'),
          eq(shelfConcepts.generationType, 'EDITORIAL'),
          eq(shelfConcepts.generationType, 'DISCOVERY'),
        ),
      ),
    )
    .orderBy(desc(shelfConcepts.createdAt))
    .limit(20)

  const candidates = conceptRows.filter((c) => !usedConceptIds.has(c.id))
  if (candidates.length === 0) return null

  const fatigueStates = await fatigueService.getFatigueStates(profileId, candidates.map((c) => c.id))
  const nowMs = Date.now()
  for (const concept of candidates) {
    const state = fatigueStates.get(concept.id)
    if (state?.cooldownUntil && new Date(state.cooldownUntil).getTime() > nowMs) continue
    return concept
  }
  return null
}

// ---------------------------------------------------------------------------
// Declared rails — first-render personalized Home sequence
// ---------------------------------------------------------------------------

type PendingRail = {
  title: string
  candidates: ShelfCandidateItem[]
  conceptId: string | null
  semanticIntent: string | null
  queryPlannerVersion: string
  embeddingModelVersion: string
  rankerVersion: string
  candidateCount: number
  latencyMs: number
  verticalPosition: number
}

export async function buildDeclaredRails(
  profileId: string,
  sessionId: string,
): Promise<{ shelves: ShelfResponse[]; nextPoolPosition: number; shelfInstanceIds: string[]; hero: HeroItem | null }> {
  console.log(`[HOME_GENERATION] expensive LLM/semantic generation triggered profileId=${profileId}`)
  const excludedMediaIds = new Set<string>()
  const shelfInstanceService = new ShelfInstanceService(db)
  const fatigueService = new ShelfFatigueService(db)
  const servedAt = new Date()
  let nextPosition = 0
  const results: ShelfResponse[] = []
  const pendingRails: PendingRail[] = []
  let hero: HeroItem | null = null

  // Helper: query engine or fall back to rankRecommendations.
  async function queryCandidates(params: {
    text: string
    mediaTypeFilter?: 'MOVIE' | 'SERIES'
    freshnessBoostDays?: number
  }): Promise<{
    candidates: ShelfCandidateItem[]
    queryPlannerVersion: string
    embeddingModelVersion: string
    rankerVersion: string
    candidateCount: number
  }> {
    const requestLimit = Math.min(HOME_ITEMS_PER_SHELF + excludedMediaIds.size + 10, HOME_ITEMS_MAX)

    const engineResult = await RecommendationEngineClient.queryForShelf({
      text: params.text,
      profileId,
      limit: requestLimit,
      mediaTypeFilter: params.mediaTypeFilter,
      freshnessBoostDays: params.freshnessBoostDays,
    })

    if (engineResult) {
      let pool = engineResult.candidates.filter((c) => !excludedMediaIds.has(c.mediaId))
      if (params.mediaTypeFilter) pool = pool.filter((c) => c.mediaType === params.mediaTypeFilter)
      return {
        candidates: pool.slice(0, HOME_ITEMS_PER_SHELF),
        queryPlannerVersion: engineResult.queryPlannerVersion,
        embeddingModelVersion: engineResult.embeddingModelVersion,
        rankerVersion: engineResult.rankerVersion,
        candidateCount: engineResult.candidateCount,
      }
    }

    const recResult = await rankRecommendations(profileId, {
      limit: requestLimit,
      mediaType: params.mediaTypeFilter,
      includeSeen: false,
    })
    let pool = recResult.candidates.filter((c) => !excludedMediaIds.has(c.mediaId))
    if (params.mediaTypeFilter) pool = pool.filter((c) => c.mediaType === params.mediaTypeFilter)
    return {
      candidates: pool.slice(0, HOME_ITEMS_PER_SHELF).map((c) => ({
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
    }
  }

  // ── Rail 1: Continuer à regarder (dedup-exempt, already enriched) ──────────
  try {
    const cw = await getShelf('sys_continue_watching', profileId)
    if (cw.items.length > 0) results.push(cw)
    // NOT added to excludedMediaIds per spec
  } catch (err) {
    console.error('[home-pool] declared rail 1 "Continuer à regarder" failed:', err)
  }

  // ── Rail 2: "Pour toi" ─────────────────────────────────────────────────────
  let pourToiCandidates: ShelfCandidateItem[] = []
  try {
    const t0 = Date.now()
    const { candidates, ...meta } = await queryCandidates({ text: 'films et séries recommandés pour ce profil' })
    pourToiCandidates = candidates

    // Select hero before queuing Pour toi so the hero mediaId can be filtered out of the rail
    try {
      hero = await selectHero(profileId, pourToiCandidates)
      if (hero) excludedMediaIds.add(hero.mediaId)
    } catch (err) {
      console.error('[home-pool] hero selection failed (continuing without hero):', err)
    }

    const filteredPourToi = pourToiCandidates.filter((c) => c.mediaId !== hero?.mediaId)
    if (filteredPourToi.length > 0) {
      pendingRails.push({ title: 'Pour toi', candidates: filteredPourToi, conceptId: null, semanticIntent: null, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ })
      for (const c of filteredPourToi) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[home-pool] declared rail 2 "Pour toi" failed:', err)
  }

  // ── Rail 3: "Nouveautés pour toi" ──────────────────────────────────────────
  try {
    const t0 = Date.now()
    const cutoff = new Date(Date.now() - HOME_FRESH_DAYS * 24 * 60 * 60 * 1000)
    const { candidates: raw, ...meta } = await queryCandidates({
      text: 'nouveaux films et séries sortis récemment',
      freshnessBoostDays: HOME_FRESH_DAYS,
    })
    const freshIds = await getFreshMediaIds(raw, cutoff)
    const candidates = raw.filter((c) => freshIds.has(c.mediaId))
    if (candidates.length > 0) {
      pendingRails.push({ title: 'Nouveautés pour toi', candidates, conceptId: null, semanticIntent: null, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ })
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[home-pool] declared rail 3 "Nouveautés pour toi" failed:', err)
  }

  // ── Rail 4: Dynamic thematic ────────────────────────────────────────────────
  try {
    const t0 = Date.now()
    const concept = await selectThematicConcept(profileId, sessionId, fatigueService)
    if (concept) {
      const { candidates, ...meta } = await queryCandidates({ text: concept.semanticIntent })
      if (candidates.length > 0) {
        pendingRails.push({ title: concept.title, candidates, conceptId: concept.id, semanticIntent: concept.semanticIntent, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ })
        for (const c of candidates) excludedMediaIds.add(c.mediaId)
      }
    }
  } catch (err) {
    console.error('[home-pool] declared rail 4 "Thematic" failed:', err)
  }

  // ── Rail 5: "Films pour toi" ────────────────────────────────────────────────
  try {
    const t0 = Date.now()
    const { candidates, ...meta } = await queryCandidates({ text: 'films recommandés pour ce profil', mediaTypeFilter: 'MOVIE' })
    if (candidates.length > 0) {
      pendingRails.push({ title: 'Films pour toi', candidates, conceptId: null, semanticIntent: null, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ })
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[home-pool] declared rail 5 "Films pour toi" failed:', err)
  }

  // ── Rail 6: "Séries pour toi" ───────────────────────────────────────────────
  try {
    const t0 = Date.now()
    const { candidates, ...meta } = await queryCandidates({ text: 'séries recommandées pour ce profil', mediaTypeFilter: 'SERIES' })
    if (candidates.length > 0) {
      pendingRails.push({ title: 'Séries pour toi', candidates, conceptId: null, semanticIntent: null, ...meta, latencyMs: Date.now() - t0, verticalPosition: nextPosition++ })
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[home-pool] declared rail 6 "Séries pour toi" failed:', err)
  }

  if (pendingRails.length === 0) return { shelves: results, nextPoolPosition: nextPosition, shelfInstanceIds: [], hero }

  // ── Batch enrich all items from rails 2–6 in one round-trip ───────────────
  const allItems = pendingRails.flatMap((r) => r.candidates.map((c) => ({ mediaId: c.mediaId, mediaType: c.mediaType })))
  const enrichmentMap = await buildEnrichmentMap(allItems)

  // ── Persist + assemble ShelfResponse for each pending rail ─────────────────
  const shelfInstanceIds: string[] = []
  for (const rail of pendingRails) {
    try {
      const instanceId = await shelfInstanceService.persistShelfInstance({
        profileId,
        shelfConceptId: rail.conceptId,
        title: rail.title,
        semanticIntentSnapshot: rail.semanticIntent,
        generationType: 'SYSTEM_DECLARED',
        generationReasonCodes: [],
        homeSessionId: sessionId,
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
      })

      shelfInstanceIds.push(instanceId)
      results.push({
        id: instanceId,
        title: rail.title,
        type: 'GENERATED' as const,
        layoutHint: 'ROW' as const,
        shelfInstanceId: instanceId,
        items: rail.candidates.map((c): ShelfItem => ({
          mediaType: c.mediaType,
          mediaId: c.mediaId,
          title: enrichmentMap.get(c.mediaId)?.title ?? '',
          posterUrl: enrichmentMap.get(c.mediaId)?.posterUrl ?? null,
          trailerKey: enrichmentMap.get(c.mediaId)?.trailerKey ?? null,
        })),
      })
    } catch (err) {
      console.error(`[home-pool] failed to persist declared rail "${rail.title}":`, err)
    }
  }

  return { shelves: results, nextPoolPosition: nextPosition, shelfInstanceIds, hero }
}

// ---------------------------------------------------------------------------
// Fallback catalog shelves (when rec service is unavailable)
// ---------------------------------------------------------------------------

export async function buildFallbackShelf(): Promise<ShelfResponse> {
  const rows = await db
    .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
    .from(movies)
    .innerJoin(movieAvailabilities, eq(movieAvailabilities.movieId, movies.id))
    .orderBy(desc(movies.voteAverage), desc(movies.popularity))
    .limit(HOME_ITEMS_PER_SHELF)

  const items: ShelfItem[] = rows.map((r) => ({
    mediaType: 'MOVIE' as const,
    mediaId: r.id,
    title: r.title,
    posterUrl: resolveMediaImageUrl(r.posterPath),
  }))

  return {
    id: 'sys_fallback_popular',
    title: 'Films populaires',
    type: 'SYSTEM',
    layoutHint: 'ROW',
    items,
  }
}
