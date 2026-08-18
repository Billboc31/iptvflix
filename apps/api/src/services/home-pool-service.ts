import { eq, and, isNull, asc, count, inArray, notInArray, sql, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelfInstances,
  shelfInstanceItems,
  recommendationHomeSessions,
  shelfConcepts,
  movies,
  series,
  movieAvailabilities,
} from '../db/schema/index.js'
import {
  HOME_BATCH_SIZE,
  HOME_ITEMS_MAX,
  HOME_ITEMS_PER_SHELF,
  HOME_POOL_TARGET,
  HOME_SESSION_TTL_HOURS,
} from '../config/env.js'
import { ShelfInstanceService } from './shelf-instance-service.js'
import { ShelfFatigueService } from './shelf-fatigue-service.js'
import { rankRecommendations } from './recommendation-ranking-service.js'
import { getShelf } from './shelf-service.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import type { ShelfResponse, ShelfItem } from '@iptvflix/api-contracts'

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
      const needed = HOME_ITEMS_PER_SHELF + excludedMediaIds.size
      const recResult = await rankRecommendations(profileId, {
        limit: Math.min(needed + 10, HOME_ITEMS_MAX + excludedMediaIds.size),
        includeSeen: false,
      })

      const candidates = recResult.candidates
        .filter((c) => !excludedMediaIds.has(c.mediaId))
        .slice(0, HOME_ITEMS_PER_SHELF)

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
        rankerVersion: MODEL_VERSION,
        queryPlannerVersion: MODEL_VERSION,
        embeddingModelVersion: 'none',
        candidateCount: recResult.candidates.length,
        cacheHit: false,
        items: candidates.map((c, i) => ({
          mediaType: c.mediaType,
          mediaId: c.mediaId,
          rankPosition: i,
          finalScore: c.score,
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

// ---------------------------------------------------------------------------
// Persist fixed shelves into session for dedup coherence
// ---------------------------------------------------------------------------

export async function persistFixedShelvesForSession(
  profileId: string,
  sessionId: string,
  fixed: ShelfResponse[],
): Promise<void> {
  const existing = await db
    .select({ id: shelfInstances.id })
    .from(shelfInstances)
    .where(
      and(
        eq(shelfInstances.homeSessionId, sessionId),
        eq(shelfInstances.generationType, 'SYSTEM_FIXED'),
      ),
    )
    .limit(1)
  if (existing.length > 0) return

  const shelfInstanceService = new ShelfInstanceService(db)
  const now = new Date()

  for (let i = 0; i < fixed.length; i++) {
    const shelf = fixed[i]
    if (shelf.items.length === 0) continue
    try {
      await shelfInstanceService.persistShelfInstance({
        profileId,
        shelfConceptId: null,
        title: shelf.title,
        generationType: 'SYSTEM_FIXED',
        generationReasonCodes: [shelf.id],
        homeSessionId: sessionId,
        verticalPosition: -(fixed.length - i),
        rankerVersion: MODEL_VERSION,
        queryPlannerVersion: MODEL_VERSION,
        embeddingModelVersion: 'none',
        cacheHit: false,
        servedAt: now,
        items: shelf.items.map((item, rank) => ({
          mediaType: item.mediaType,
          mediaId: item.mediaId,
          rankPosition: rank,
          wasEligibleAtGeneration: true,
        })),
      })
    } catch (err) {
      console.error('[home-pool] failed to persist fixed shelf for dedup:', err)
    }
  }
}
