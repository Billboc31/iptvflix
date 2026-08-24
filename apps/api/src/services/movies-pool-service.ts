import { eq, and, isNull, asc, count, inArray, sql, desc, gte, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelfInstances,
  shelfInstanceItems,
  moviesSessions,
  shelfConcepts,
  movies,
  mediaVideos,
  movieAvailabilities,
} from '../db/schema/index.js'
import {
  HOME_FRESH_DAYS,
  MOVIES_BATCH_SIZE,
  MOVIES_ITEMS_MAX,
  MOVIES_ITEMS_PER_SHELF,
  MOVIES_POOL_TARGET,
  MOVIES_SESSION_TTL_HOURS,
  MOVIES_EXPLORATION_RATIO,
} from '../config/env.js'
import { ShelfInstanceService } from './shelf-instance-service.js'
import { ShelfFatigueService } from './shelf-fatigue-service.js'
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js'
import { rankRecommendations } from './recommendation-ranking-service.js'
import type { ShelfCandidateItem } from '../client/recommendation-engine-client.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import type { ShelfResponse, ShelfItem } from '@iptvflix/api-contracts'

const MODEL_VERSION = 'v1'
const EXHAUSTED_MARKER = 'exhausted'

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function getOrCreateMoviesSession(profileId: string): Promise<{ id: string; profileId: string; cursorReference: string | null }> {
  const now = new Date()
  const existing = await db
    .select()
    .from(moviesSessions)
    .where(
      and(
        eq(moviesSessions.profileId, profileId),
        sql`${moviesSessions.expiresAt} > ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(moviesSessions.startedAt))
    .limit(1)

  if (existing.length > 0) {
    const s = existing[0]
    return { id: s.id, profileId: s.profileId, cursorReference: s.cursorReference }
  }

  const expiresAt = new Date(now.getTime() + MOVIES_SESSION_TTL_HOURS * 60 * 60 * 1000)
  const [inserted] = await db
    .insert(moviesSessions)
    .values({ profileId, expiresAt })
    .returning()

  return { id: inserted.id, profileId: inserted.profileId, cursorReference: null }
}

export async function getMoviesSessionById(sessionId: string): Promise<{ id: string; profileId: string; cursorReference: string | null } | null> {
  const [row] = await db
    .select()
    .from(moviesSessions)
    .where(eq(moviesSessions.id, sessionId))
    .limit(1)
  if (!row) return null
  return { id: row.id, profileId: row.profileId, cursorReference: row.cursorReference }
}

// ---------------------------------------------------------------------------
// Pool queries
// ---------------------------------------------------------------------------

export async function countMoviesUnserved(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(shelfInstances)
    .where(and(eq(shelfInstances.moviesSessionId, sessionId), isNull(shelfInstances.servedAt)))
  return Number(row?.n ?? 0)
}

export async function serveMoviesBatch(
  sessionId: string,
  nextPosition: number,
  batchSize: number = MOVIES_BATCH_SIZE,
): Promise<{ shelves: Array<{ instanceId: string; title: string; verticalPosition: number; items: Array<{ mediaType: string; mediaId: string }> }>; newNextPosition: number; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(shelfInstances)
    .where(
      and(
        eq(shelfInstances.moviesSessionId, sessionId),
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

  const remaining = await countMoviesUnserved(sessionId)
  const hasMore = remaining > 0

  return { shelves, newNextPosition, hasMore }
}

// ---------------------------------------------------------------------------
// Pool filling
// ---------------------------------------------------------------------------

export function fillMoviesPool(sessionId: string, profileId: string, targetCount: number): void {
  _fillMoviesPoolAsync(sessionId, profileId, targetCount).catch((err) => {
    console.error('[movies-pool] fillMoviesPool error (swallowed):', err)
  })
}

export async function fillMoviesPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void> {
  return _fillMoviesPoolAsync(sessionId, profileId, targetCount)
}

async function _fillMoviesPoolAsync(sessionId: string, profileId: string, targetCount: number): Promise<void> {
  console.log(`[MOVIES_GENERATION] pool fill triggered sessionId=${sessionId}`)

  const servedItems = await db
    .select({ mediaId: shelfInstanceItems.mediaId })
    .from(shelfInstanceItems)
    .innerJoin(shelfInstances, eq(shelfInstances.id, shelfInstanceItems.shelfInstanceId))
    .where(eq(shelfInstances.moviesSessionId, sessionId))

  const excludedMediaIds = new Set(servedItems.map((r) => r.mediaId))

  const sessionConceptRows = await db
    .select({ shelfConceptId: shelfInstances.shelfConceptId })
    .from(shelfInstances)
    .where(and(eq(shelfInstances.moviesSessionId, sessionId), sql`${shelfInstances.shelfConceptId} IS NOT NULL`))

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
        sql`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb`,
      ),
    )
    .orderBy(desc(shelfConcepts.createdAt))
    .limit(targetCount * 4)

  const candidateConcepts = conceptRows.filter((c) => !usedConceptIds.has(c.id))

  const fatigueService = new ShelfFatigueService(db)
  const fatigueStates = await fatigueService.getFatigueStates(profileId, candidateConcepts.map((c) => c.id))
  const now = Date.now()
  const eligibleConcepts = candidateConcepts.filter((c) => {
    const state = fatigueStates.get(c.id)
    if (!state) return true
    if (state.cooldownUntil && new Date(state.cooldownUntil).getTime() > now) return false
    return true
  })

  const [maxPosRow] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${shelfInstances.verticalPosition}), -1)` })
    .from(shelfInstances)
    .where(eq(shelfInstances.moviesSessionId, sessionId))

  let nextPosition = (maxPosRow?.maxPos ?? -1) + 1

  const explorationConcepts = eligibleConcepts.filter((c) => c.generationType === 'EXPLORATION' || c.generationType === 'DISCOVERY')
  const exploitationConcepts = eligibleConcepts.filter((c) => c.generationType !== 'EXPLORATION' && c.generationType !== 'DISCOVERY')

  let explorationUsed = 0
  let exploitationUsed = 0

  const shelfInstanceService = new ShelfInstanceService(db)
  let generated = 0

  while (generated < targetCount) {
    const totalUsed = explorationUsed + exploitationUsed
    const currentRatio = totalUsed === 0 ? 0 : explorationUsed / totalUsed
    const useExploration = currentRatio < MOVIES_EXPLORATION_RATIO && explorationConcepts.length > 0

    const concept = useExploration
      ? (explorationConcepts.shift() ?? exploitationConcepts.shift())
      : (exploitationConcepts.shift() ?? explorationConcepts.shift())

    if (!concept) break

    try {
      const requestLimit = Math.min(MOVIES_ITEMS_PER_SHELF + excludedMediaIds.size + 10, MOVIES_ITEMS_MAX)
      const t0 = Date.now()

      const engineResult = await RecommendationEngineClient.queryForShelf({
        text: concept.semanticIntent,
        profileId,
        limit: requestLimit,
      })

      let candidates: ShelfCandidateItem[]
      let queryPlannerVersion = MODEL_VERSION
      let embeddingModelVersion = 'none'
      let rankerVersion = MODEL_VERSION
      let totalCandidateCount = 0

      if (engineResult) {
        let pool = engineResult.candidates
          .filter((c) => c.mediaType === 'MOVIE')
          .filter((c) => !excludedMediaIds.has(c.mediaId))

        candidates = pool.slice(0, MOVIES_ITEMS_PER_SHELF)
        queryPlannerVersion = engineResult.queryPlannerVersion
        embeddingModelVersion = engineResult.embeddingModelVersion
        rankerVersion = engineResult.rankerVersion
        totalCandidateCount = engineResult.candidateCount
      } else {
        const recResult = await rankRecommendations(profileId, {
          limit: requestLimit,
          mediaType: 'MOVIE',
          includeSeen: false,
        })
        candidates = recResult.candidates
          .filter((c) => c.mediaType === 'MOVIE')
          .filter((c) => !excludedMediaIds.has(c.mediaId))
          .slice(0, MOVIES_ITEMS_PER_SHELF)
          .map((c) => ({
            mediaId: c.mediaId,
            mediaType: 'MOVIE' as const,
            semanticScore: 0,
            profileScore: c.score ?? 0,
            finalScore: c.score ?? 0,
            reasons: c.reasons ?? [],
            available: c.available ?? false,
            qualityPrior: c.scoreBreakdown?.qualityPrior ?? 0,
            languageAffinity: c.scoreBreakdown?.languageAffinity ?? 0,
          }))
        totalCandidateCount = recResult.candidates.length
      }

      if (candidates.length === 0) {
        if (concept.generationType === 'EXPLORATION' || concept.generationType === 'DISCOVERY') {
          explorationUsed++
        } else {
          exploitationUsed++
        }
        continue
      }

      await shelfInstanceService.persistShelfInstance({
        profileId,
        shelfConceptId: concept.id,
        title: concept.title,
        semanticIntentSnapshot: concept.semanticIntent,
        generationType: concept.generationType,
        generationReasonCodes: (concept.reasonCodes as string[]) ?? [],
        moviesSessionId: sessionId,
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

      for (const c of candidates) excludedMediaIds.add(c.mediaId)
      usedConceptIds.add(concept.id)
      nextPosition++
      generated++

      if (concept.generationType === 'EXPLORATION' || concept.generationType === 'DISCOVERY') {
        explorationUsed++
      } else {
        exploitationUsed++
      }
    } catch (err) {
      console.error('[movies-pool] shelf generation error (concept skipped):', err)
    }
  }

  if (generated === 0 && explorationConcepts.length === 0 && exploitationConcepts.length === 0) {
    await db
      .update(moviesSessions)
      .set({ cursorReference: EXHAUSTED_MARKER })
      .where(eq(moviesSessions.id, sessionId))
    console.log(`[movies-pool] session ${sessionId} marked exhausted`)
  }
}

// ---------------------------------------------------------------------------
// Declared rails helpers
// ---------------------------------------------------------------------------

async function getFreshMovieIds(movieIds: string[], cutoffDate: Date): Promise<Set<string>> {
  if (movieIds.length === 0) return new Set()
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 10)
  const rows = await db
    .select({ id: movies.id })
    .from(movies)
    .where(and(
      inArray(movies.id, movieIds),
      or(
        gte(movies.theatricalReleaseDate, cutoffDateStr),
        gte(movies.digitalReleaseDate, cutoffDateStr),
      ),
    ))
  return new Set(rows.map((r) => r.id))
}

async function queryCandidatesForMovies(params: {
  text: string
  profileId: string
  excludedMediaIds: Set<string>
}): Promise<{
  candidates: ShelfCandidateItem[]
  queryPlannerVersion: string
  embeddingModelVersion: string
  rankerVersion: string
  candidateCount: number
}> {
  const requestLimit = Math.min(MOVIES_ITEMS_PER_SHELF + params.excludedMediaIds.size + 10, MOVIES_ITEMS_MAX)

  const engineResult = await RecommendationEngineClient.queryForShelf({
    text: params.text,
    profileId: params.profileId,
    limit: requestLimit,
  })

  if (engineResult) {
    const pool = engineResult.candidates
      .filter((c) => c.mediaType === 'MOVIE')
      .filter((c) => !params.excludedMediaIds.has(c.mediaId))
    return {
      candidates: pool.slice(0, MOVIES_ITEMS_PER_SHELF),
      queryPlannerVersion: engineResult.queryPlannerVersion,
      embeddingModelVersion: engineResult.embeddingModelVersion,
      rankerVersion: engineResult.rankerVersion,
      candidateCount: engineResult.candidateCount,
    }
  }

  const recResult = await rankRecommendations(params.profileId, {
    limit: requestLimit,
    mediaType: 'MOVIE',
    includeSeen: false,
  })
  const pool = recResult.candidates
    .filter((c) => c.mediaType === 'MOVIE')
    .filter((c) => !params.excludedMediaIds.has(c.mediaId))
  return {
    candidates: pool.slice(0, MOVIES_ITEMS_PER_SHELF).map((c) => ({
      mediaId: c.mediaId,
      mediaType: 'MOVIE' as const,
      semanticScore: 0,
      profileScore: c.score ?? 0,
      finalScore: c.score ?? 0,
      reasons: c.reasons ?? [],
      available: c.available ?? false,
      qualityPrior: c.scoreBreakdown?.qualityPrior ?? 0,
      languageAffinity: c.scoreBreakdown?.languageAffinity ?? 0,
    })),
    queryPlannerVersion: MODEL_VERSION,
    embeddingModelVersion: 'none',
    rankerVersion: MODEL_VERSION,
    candidateCount: recResult.candidates.length,
  }
}

async function selectThematicMovieConcept(
  profileId: string,
  usedConceptIds: Set<string>,
  fatigueService: ShelfFatigueService,
): Promise<typeof shelfConcepts.$inferSelect | null> {
  const conceptRows = await db
    .select()
    .from(shelfConcepts)
    .where(
      and(
        eq(shelfConcepts.profileId, profileId),
        eq(shelfConcepts.active, true),
        eq(shelfConcepts.generationType, 'PERSONALIZED'),
        sql`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb`,
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

async function selectExplorationMovieConcept(
  profileId: string,
  usedConceptIds: Set<string>,
  fatigueService: ShelfFatigueService,
): Promise<typeof shelfConcepts.$inferSelect | null> {
  const conceptRows = await db
    .select()
    .from(shelfConcepts)
    .where(
      and(
        eq(shelfConcepts.profileId, profileId),
        eq(shelfConcepts.active, true),
        inArray(shelfConcepts.generationType, ['EXPLORATION', 'DISCOVERY']),
        sql`${shelfConcepts.desiredMediaTypes} @> '["MOVIE"]'::jsonb`,
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
// Declared rails — first-render personalized Movies sequence
// ---------------------------------------------------------------------------

type PendingMovieRail = {
  title: string
  candidates: ShelfCandidateItem[]
  conceptId: string | null
  generationType: string
  semanticIntent: string | null
  queryPlannerVersion: string
  embeddingModelVersion: string
  rankerVersion: string
  candidateCount: number
  latencyMs: number
  verticalPosition: number
}

export async function buildMoviesDeclaredRails(
  profileId: string,
  sessionId: string,
): Promise<{ shelves: ShelfResponse[]; nextPoolPosition: number; shelfInstanceIds: string[] }> {
  console.log(`[MOVIES_GENERATION] declared rails triggered profileId=${profileId}`)
  const excludedMediaIds = new Set<string>()
  const usedConceptIds = new Set<string>()
  const shelfInstanceService = new ShelfInstanceService(db)
  const fatigueService = new ShelfFatigueService(db)
  const servedAt = new Date()
  let nextPosition = 0
  const pendingRails: PendingMovieRail[] = []

  // ── Rail 1: "Pour toi" — movie-only general recommendations ───────────────
  try {
    const t0 = Date.now()
    const { candidates, ...meta } = await queryCandidatesForMovies({
      text: 'films recommandés pour ce profil',
      profileId,
      excludedMediaIds,
    })
    if (candidates.length > 0) {
      pendingRails.push({
        title: 'Pour toi',
        candidates,
        conceptId: null,
        generationType: 'SYSTEM_DECLARED',
        semanticIntent: null,
        ...meta,
        latencyMs: Date.now() - t0,
        verticalPosition: nextPosition++,
      })
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[movies-pool] declared rail 1 "Pour toi" failed:', err)
  }

  // ── Rail 2: "Nouveautés pour toi" — recent movies ─────────────────────────
  try {
    const t0 = Date.now()
    const cutoff = new Date(Date.now() - HOME_FRESH_DAYS * 24 * 60 * 60 * 1000)
    const { candidates: raw, ...meta } = await queryCandidatesForMovies({
      text: 'nouveaux films sortis récemment',
      profileId,
      excludedMediaIds,
    })
    const freshIds = await getFreshMovieIds(raw.map((c) => c.mediaId), cutoff)
    const candidates = raw.filter((c) => freshIds.has(c.mediaId))
    if (candidates.length > 0) {
      pendingRails.push({
        title: 'Nouveautés pour toi',
        candidates,
        conceptId: null,
        generationType: 'SYSTEM_DECLARED',
        semanticIntent: null,
        ...meta,
        latencyMs: Date.now() - t0,
        verticalPosition: nextPosition++,
      })
      for (const c of candidates) excludedMediaIds.add(c.mediaId)
    }
  } catch (err) {
    console.error('[movies-pool] declared rail 2 "Nouveautés pour toi" failed:', err)
  }

  // ── Rails 3-4: Two PERSONALIZED thematic shelves ──────────────────────────
  for (let i = 0; i < 2; i++) {
    try {
      const t0 = Date.now()
      const concept = await selectThematicMovieConcept(profileId, usedConceptIds, fatigueService)
      if (concept) {
        const { candidates, ...meta } = await queryCandidatesForMovies({
          text: concept.semanticIntent,
          profileId,
          excludedMediaIds,
        })
        if (candidates.length > 0) {
          pendingRails.push({
            title: concept.title,
            candidates,
            conceptId: concept.id,
            generationType: concept.generationType,
            semanticIntent: concept.semanticIntent,
            ...meta,
            latencyMs: Date.now() - t0,
            verticalPosition: nextPosition++,
          })
          for (const c of candidates) excludedMediaIds.add(c.mediaId)
          usedConceptIds.add(concept.id)
        }
      }
    } catch (err) {
      console.error(`[movies-pool] declared rail ${3 + i} thematic PERSONALIZED failed:`, err)
    }
  }

  // ── Rail 5: EXPLORATION/DISCOVERY thematic shelf (guaranteed) ─────────────
  try {
    const t0 = Date.now()
    const concept = await selectExplorationMovieConcept(profileId, usedConceptIds, fatigueService)
    if (concept) {
      const { candidates, ...meta } = await queryCandidatesForMovies({
        text: concept.semanticIntent,
        profileId,
        excludedMediaIds,
      })
      if (candidates.length > 0) {
        pendingRails.push({
          title: concept.title,
          candidates,
          conceptId: concept.id,
          generationType: concept.generationType,
          semanticIntent: concept.semanticIntent,
          ...meta,
          latencyMs: Date.now() - t0,
          verticalPosition: nextPosition++,
        })
        for (const c of candidates) excludedMediaIds.add(c.mediaId)
        usedConceptIds.add(concept.id)
      }
    }
  } catch (err) {
    console.error('[movies-pool] declared rail 5 EXPLORATION failed:', err)
  }

  // ── Rail 6: Third PERSONALIZED thematic shelf ─────────────────────────────
  try {
    const t0 = Date.now()
    const concept = await selectThematicMovieConcept(profileId, usedConceptIds, fatigueService)
    if (concept) {
      const { candidates, ...meta } = await queryCandidatesForMovies({
        text: concept.semanticIntent,
        profileId,
        excludedMediaIds,
      })
      if (candidates.length > 0) {
        pendingRails.push({
          title: concept.title,
          candidates,
          conceptId: concept.id,
          generationType: concept.generationType,
          semanticIntent: concept.semanticIntent,
          ...meta,
          latencyMs: Date.now() - t0,
          verticalPosition: nextPosition++,
        })
        for (const c of candidates) excludedMediaIds.add(c.mediaId)
        usedConceptIds.add(concept.id)
      }
    }
  } catch (err) {
    console.error('[movies-pool] declared rail 6 thematic PERSONALIZED failed:', err)
  }

  if (pendingRails.length === 0) {
    return { shelves: [], nextPoolPosition: nextPosition, shelfInstanceIds: [] }
  }

  // ── Batch enrich all items in one round-trip ───────────────────────────────
  const allMovieIds = pendingRails.flatMap((r) => r.candidates.map((c) => c.mediaId))
  const enrichmentMap = await buildMovieEnrichmentMap(allMovieIds)

  // ── Persist + assemble ShelfResponse for each rail ────────────────────────
  const results: ShelfResponse[] = []
  const shelfInstanceIds: string[] = []

  for (const rail of pendingRails) {
    try {
      const instanceId = await shelfInstanceService.persistShelfInstance({
        profileId,
        shelfConceptId: rail.conceptId,
        title: rail.title,
        semanticIntentSnapshot: rail.semanticIntent,
        generationType: rail.generationType,
        generationReasonCodes: [],
        moviesSessionId: sessionId,
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
          mediaType: c.mediaType as 'MOVIE',
          mediaId: c.mediaId,
          title: enrichmentMap.get(c.mediaId)?.title ?? '',
          posterUrl: enrichmentMap.get(c.mediaId)?.posterUrl ?? null,
          trailerKey: enrichmentMap.get(c.mediaId)?.trailerKey ?? null,
        })),
      })
    } catch (err) {
      console.error(`[movies-pool] failed to persist declared rail "${rail.title}":`, err)
    }
  }

  return { shelves: results, nextPoolPosition: nextPosition, shelfInstanceIds }
}

// ---------------------------------------------------------------------------
// Movie enrichment helper
// ---------------------------------------------------------------------------

async function buildMovieEnrichmentMap(
  movieIds: string[],
): Promise<Map<string, { title: string; posterUrl: string | null; trailerKey: string | null }>> {
  if (movieIds.length === 0) return new Map()

  const [movieRows, trailerRows] = await Promise.all([
    db.select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
      .from(movies)
      .where(inArray(movies.id, movieIds)),
    db.select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
      .from(mediaVideos)
      .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds))),
  ])

  const result = new Map<string, { title: string; posterUrl: string | null; trailerKey: string | null }>()
  for (const r of movieRows) {
    result.set(r.id, { title: r.title, posterUrl: resolveMediaImageUrl(r.posterPath), trailerKey: null })
  }
  for (const r of trailerRows) {
    const entry = result.get(r.mediaId)
    if (entry && !entry.trailerKey) entry.trailerKey = r.youtubeKey
  }
  return result
}

// ---------------------------------------------------------------------------
// Fallback shelf (cold start / rec service unavailable)
// ---------------------------------------------------------------------------

export async function buildMoviesFallbackShelf(): Promise<ShelfResponse> {
  const rows = await db
    .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
    .from(movies)
    .innerJoin(movieAvailabilities, eq(movieAvailabilities.movieId, movies.id))
    .orderBy(desc(movies.voteAverage), desc(movies.popularity))
    .limit(MOVIES_ITEMS_PER_SHELF)

  const items: ShelfItem[] = rows.map((r) => ({
    mediaType: 'MOVIE' as const,
    mediaId: r.id,
    title: r.title,
    posterUrl: resolveMediaImageUrl(r.posterPath),
  }))

  return {
    id: 'sys_fallback_popular_movies',
    title: 'Films populaires',
    type: 'SYSTEM',
    layoutHint: 'ROW',
    items,
  }
}
