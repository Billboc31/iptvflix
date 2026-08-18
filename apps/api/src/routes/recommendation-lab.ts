import { createHash } from 'node:crypto'
import { eq, and, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { ShelfInstanceService } from '../services/shelf-instance-service.js'
import { ShelfPerformanceService } from '../services/shelf-performance-service.js'
import { ShelfFatigueService } from '../services/shelf-fatigue-service.js'
import { shelfConcepts } from '../db/schema/index.js'
import {
  profileTaste,
  movies,
  series as seriesTbl,
  movieGenres,
  seriesGenres,
  movieAvailabilities,
  seriesAvailabilities,
  genres,
  mediaCredits,
  viewingProgress,
} from '../db/schema/index.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import type { SemanticResult } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { LlmQueryPlannerService } from '../services/llm-query-planner-service.js'
import { createOpenAiPlannerProvider } from '../services/openai-llm-planner-provider.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../config/env.js'
import {
  rankHybrid,
  SCORE_MODEL_V1,
  resolveImplicitShownIds,
} from '../services/recommendation-ranking-service.js'
import { EXPOSURE_MEMORY_HOURS } from '../config/env.js'
import type {
  HybridCandidate,
  TasteSignals,
  RankingOptions,
  ExplorationLevel,
} from '../services/recommendation-ranking-service.js'
import type {
  CompactTasteContext,
  RecommendationQueryPlan,
  RecommendationCandidate,
} from '@iptvflix/api-contracts'
import { rawQueryFallbackPlan } from '../query-plan-fallback.js'

// ---------------------------------------------------------------------------
// profileContext sanitisation — validate shape and bound string lengths
// to prevent prompt-injection via caller-controlled context fields.
// ---------------------------------------------------------------------------

const PROFILE_MAX_ITEMS = 20
const PROFILE_MAX_ITEM_LEN = 100

function sanitizeStringArray(field: unknown): string[] {
  if (!Array.isArray(field)) return []
  return (field as unknown[])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, PROFILE_MAX_ITEMS)
    .map((s) => s.slice(0, PROFILE_MAX_ITEM_LEN))
}

function sanitizeProfileContext(raw: unknown): CompactTasteContext | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  return {
    topGenres: sanitizeStringArray(obj.topGenres),
    topThemes: sanitizeStringArray(obj.topThemes),
    likedPeople: sanitizeStringArray(obj.likedPeople),
    recentlyWatched: sanitizeStringArray(obj.recentlyWatched),
    negativeSignals: sanitizeStringArray(obj.negativeSignals),
  }
}

// ---------------------------------------------------------------------------
// In-process LRU cache for query plans (max 100 entries, 5-minute TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  plan: RecommendationQueryPlan
  expiresAt: number
}

class PlanCache {
  private readonly map = new Map<string, CacheEntry>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key: string): RecommendationQueryPlan | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    // Move to end to maintain LRU order
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.plan
  }

  set(key: string, plan: RecommendationQueryPlan): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { plan, expiresAt: Date.now() + this.ttlMs })
  }
}

const planCache = new PlanCache(100, 5 * 60 * 1000)

function planCacheKey(rawQuery: string, profileContext: CompactTasteContext | null): string {
  const payload = rawQuery + '|' + JSON.stringify(profileContext ?? null)
  return createHash('sha256').update(payload).digest('hex')
}

// ---------------------------------------------------------------------------
// Planner service (singleton, null when no API key)
// ---------------------------------------------------------------------------

const plannerService = new LlmQueryPlannerService(
  OPENAI_API_KEY ? createOpenAiPlannerProvider(OPENAI_API_KEY, LLM_PLANNER_MODEL) : null,
)

// ---------------------------------------------------------------------------
// Hybrid enrichment helpers
// ---------------------------------------------------------------------------

async function loadTasteSignals(profileId: string): Promise<TasteSignals | null> {
  const rows = await db
    .select()
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  const row = rows[0]
  if (!row) return null

  const genreScores = (row.genreScores ?? {}) as Record<string, number>
  const genreMeta = (row.genreMeta ?? {}) as Record<string, { name: string }>
  const genreNames: Record<string, string> = {}
  for (const [id, meta] of Object.entries(genreMeta)) {
    genreNames[id] = meta.name
  }

  return {
    genreScores,
    genreNames,
    positiveMediaIds: new Set<string>(row.positiveMediaIds ?? []),
    negativeMediaIds: new Set<string>(row.negativeMediaIds ?? []),
    signalCount: row.signalCount ?? 0,
  }
}

async function enrichAsHybridCandidates(
  results: SemanticResult[],
  profileId?: string,
): Promise<HybridCandidate[]> {
  if (results.length === 0) return []

  const movieIds = results.filter((r) => r.mediaType === 'MOVIE').map((r) => r.mediaId)
  const seriesIds = results.filter((r) => r.mediaType === 'SERIES').map((r) => r.mediaId)
  const allIds = [...movieIds, ...seriesIds]

  type MovieMeta = {
    id: string
    durationMinutes: number | null
    originalLanguage: string | null
    collectionId: string | null
    popularity: number | null
    voteAverage: number | null
    keywords: string[] | null
  }
  type SeriesMeta = {
    id: string
    originalLanguage: string | null
    popularity: number | null
    voteAverage: number | null
    keywords: string[] | null
  }

  const [
    movieGenreRows,
    seriesGenreRows,
    allGenreRows,
    availMovieRows,
    availSeriesRows,
    movieMetaRows,
    seriesMetaRows,
    directorRows,
    progressRows,
  ] = await Promise.all([
    movieIds.length > 0
      ? db
          .select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId })
          .from(movieGenres)
          .where(inArray(movieGenres.movieId, movieIds))
      : Promise.resolve([] as { movieId: string; genreId: string }[]),
    seriesIds.length > 0
      ? db
          .select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId })
          .from(seriesGenres)
          .where(inArray(seriesGenres.seriesId, seriesIds))
      : Promise.resolve([] as { seriesId: string; genreId: string }[]),
    db.select({ id: genres.id, name: genres.name }).from(genres),
    movieIds.length > 0
      ? db
          .select({ movieId: movieAvailabilities.movieId })
          .from(movieAvailabilities)
          .where(
            and(
              inArray(movieAvailabilities.movieId, movieIds),
              eq(movieAvailabilities.status, 'AVAILABLE'),
            ),
          )
      : Promise.resolve([] as { movieId: string }[]),
    seriesIds.length > 0
      ? db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(
            and(
              inArray(seriesAvailabilities.seriesId, seriesIds),
              eq(seriesAvailabilities.status, 'AVAILABLE'),
            ),
          )
      : Promise.resolve([] as { seriesId: string }[]),
    movieIds.length > 0
      ? db
          .select({
            id: movies.id,
            durationMinutes: movies.durationMinutes,
            originalLanguage: movies.originalLanguage,
            collectionId: movies.collectionId,
            popularity: movies.popularity,
            voteAverage: movies.voteAverage,
            keywords: movies.keywords,
          })
          .from(movies)
          .where(inArray(movies.id, movieIds))
      : Promise.resolve([] as MovieMeta[]),
    seriesIds.length > 0
      ? db
          .select({
            id: seriesTbl.id,
            originalLanguage: seriesTbl.originalLanguage,
            popularity: seriesTbl.popularity,
            voteAverage: seriesTbl.voteAverage,
            keywords: seriesTbl.keywords,
          })
          .from(seriesTbl)
          .where(inArray(seriesTbl.id, seriesIds))
      : Promise.resolve([] as SeriesMeta[]),
    allIds.length > 0
      ? db
          .select({ mediaId: mediaCredits.mediaId, name: mediaCredits.name })
          .from(mediaCredits)
          .where(
            and(
              inArray(mediaCredits.mediaId, allIds),
              eq(mediaCredits.role, 'director'),
            ),
          )
      : Promise.resolve([] as { mediaId: string; name: string }[]),
    profileId && movieIds.length > 0
      ? db
          .select({
            mediaId: viewingProgress.mediaId,
            progressSeconds: viewingProgress.progressSeconds,
            durationSeconds: viewingProgress.durationSeconds,
          })
          .from(viewingProgress)
          .where(
            and(
              eq(viewingProgress.profileId, profileId),
              eq(viewingProgress.mediaType, 'MOVIE'),
              inArray(viewingProgress.mediaId, movieIds),
            ),
          )
      : Promise.resolve([] as { mediaId: string; progressSeconds: number; durationSeconds: number }[]),
  ])

  const genreNameMap = new Map(allGenreRows.map((g) => [g.id, g.name]))

  const movieGenreMap = new Map<string, string[]>()
  for (const { movieId, genreId } of movieGenreRows) {
    const list = movieGenreMap.get(movieId) ?? []
    list.push(genreId)
    movieGenreMap.set(movieId, list)
  }

  const seriesGenreMap = new Map<string, string[]>()
  for (const { seriesId, genreId } of seriesGenreRows) {
    const list = seriesGenreMap.get(seriesId) ?? []
    list.push(genreId)
    seriesGenreMap.set(seriesId, list)
  }

  const availMovieSet = new Set(availMovieRows.map((r) => r.movieId))
  const availSeriesSet = new Set(availSeriesRows.map((r) => r.seriesId))

  const movieMetaMap = new Map(movieMetaRows.map((m) => [m.id, m]))
  const seriesMetaMap = new Map(seriesMetaRows.map((s) => [s.id, s]))

  const directorMap = new Map<string, string[]>()
  for (const { mediaId, name } of directorRows) {
    const list = directorMap.get(mediaId) ?? []
    list.push(name)
    directorMap.set(mediaId, list)
  }

  const completionRatioMap = new Map<string, number>()
  for (const { mediaId, progressSeconds, durationSeconds } of progressRows) {
    if (durationSeconds > 0) {
      completionRatioMap.set(mediaId, progressSeconds / durationSeconds)
    }
  }

  return results.map((r) => {
    const genreIds =
      r.mediaType === 'MOVIE'
        ? (movieGenreMap.get(r.mediaId) ?? [])
        : (seriesGenreMap.get(r.mediaId) ?? [])

    const genreNames = genreIds.map((id) => genreNameMap.get(id) ?? '').filter(Boolean)
    const available =
      r.mediaType === 'MOVIE' ? availMovieSet.has(r.mediaId) : availSeriesSet.has(r.mediaId)

    const movieMeta = r.mediaType === 'MOVIE' ? (movieMetaMap.get(r.mediaId) ?? null) : null
    const seriesMeta = r.mediaType === 'SERIES' ? (seriesMetaMap.get(r.mediaId) ?? null) : null

    return {
      mediaId: r.mediaId,
      mediaType: r.mediaType as 'MOVIE' | 'SERIES',
      title: r.title,
      year: r.year,
      posterPath: r.posterPath,
      source: 'LOCAL' as const,
      similarity: r.similarity,
      genreIds,
      genreNames,
      popularity: movieMeta?.popularity ?? seriesMeta?.popularity ?? null,
      voteAverage: movieMeta?.voteAverage ?? seriesMeta?.voteAverage ?? null,
      available,
      status: null,
      collectionId: movieMeta?.collectionId ?? null,
      directors: directorMap.get(r.mediaId) ?? [],
      keywords: movieMeta?.keywords ?? seriesMeta?.keywords ?? [],
      durationMinutes: movieMeta?.durationMinutes ?? null,
      originalLanguage: movieMeta?.originalLanguage ?? seriesMeta?.originalLanguage ?? null,
      completionRatio: completionRatioMap.get(r.mediaId) ?? null,
    }
  })
}

function mapScoredToCandidate(
  c: ReturnType<typeof rankHybrid>[number],
): RecommendationCandidate {
  return {
    mediaType: c.mediaType,
    mediaId: c.mediaId,
    title: c.title,
    year: c.year,
    posterPath: c.posterPath,
    score: c.score,
    reasons: c.reasons,
    source: c.source,
    available: c.available,
    scoreBreakdown: c.scoreBreakdown,
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function recommendationLabRoutes(app: FastifyInstance): Promise<void> {
  app.post('/recommendation-lab/semantic-query', async (request, reply) => {
    if (!OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'OPENAI_API_KEY not configured' })
    }

    const body = request.body as {
      query?: string
      topK?: number
      compareQuery?: string
      expandWithLlm?: boolean
      profileContext?: CompactTasteContext
      // Hybrid ranking extensions
      useHybridRanking?: boolean
      profileId?: string
      compareProfileId?: string
      explorationLevel?: ExplorationLevel
      diversityEnabled?: boolean
      alreadyShownIds?: string[]
      debug?: boolean
    }

    const query = body?.query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' })
    }

    const rawQuery = query.trim()
    if (rawQuery.length > 500) {
      return reply.status(400).send({ error: 'query must not exceed 500 characters' })
    }
    const topK = Math.min(Math.max(1, Number(body?.topK ?? 10)), 50)
    const expandWithLlm = body?.expandWithLlm === true
    const profileContext = sanitizeProfileContext(body?.profileContext)

    const compareQuery =
      body?.compareQuery && typeof body.compareQuery === 'string'
        ? body.compareQuery.trim()
        : undefined

    const useHybridRanking = body?.useHybridRanking === true
    const profileId = typeof body?.profileId === 'string' ? body.profileId : undefined
    const compareProfileId =
      typeof body?.compareProfileId === 'string' ? body.compareProfileId : undefined
    const explorationLevel: ExplorationLevel =
      body?.explorationLevel === 'explore' || body?.explorationLevel === 'discover'
        ? body.explorationLevel
        : 'exploit'
    const diversityEnabled = body?.diversityEnabled !== false
    const bodyShownIds = Array.isArray(body?.alreadyShownIds)
      ? (body.alreadyShownIds as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .slice(0, 500)
      : null
    const alreadyShownIds: string[] =
      bodyShownIds !== null
        ? bodyShownIds
        : profileId && useHybridRanking
          ? await resolveImplicitShownIds(profileId, EXPOSURE_MEMORY_HOURS)
          : []
    const debugMode = body?.debug === true

    const provider = createDefaultProvider(OPENAI_API_KEY)
    const embeddingService = new EmbeddingService(db, provider)
    const retrievalService = new SemanticRetrievalService(db, embeddingService)

    if (expandWithLlm) {
      // Check cache first
      const cacheKey = planCacheKey(rawQuery, profileContext)
      let plan = planCache.get(cacheKey)

      if (!plan) {
        plan = await plannerService.plan(rawQuery, profileContext)
        if (!plan.plannerFallback) {
          planCache.set(cacheKey, plan)
        }
      }

      // Path B: embed semanticIntent; Path A: embed raw query (compareResults)
      const effectiveCompareQuery = compareQuery ?? rawQuery
      const [expandedResults, rawResults] = await Promise.all([
        retrievalService.retrieve(rawQuery, topK, plan.semanticIntent),
        retrievalService.retrieve(effectiveCompareQuery, topK),
      ])

      // Apply hard filters available in SemanticResult.
      // Enforced: mediaTypes, minReleaseYear, maxReleaseYear (year field present after enrichWithMetadata).
      // NOT enforced (no genre/audio data in SemanticResult): excludeGenres, includeGenres,
      // audioLanguages, maxRuntimeMinutes — shown in QueryPlanPanel as unenforced.
      const filteredTypes =
        plan.mediaTypes.length > 0 && plan.mediaTypes.length < 2
          ? new Set(plan.mediaTypes)
          : null

      const { minReleaseYear, maxReleaseYear } = plan.hardFilters

      const filteredResults = expandedResults.filter((r) => {
        if (filteredTypes && !filteredTypes.has(r.mediaType)) return false
        if (minReleaseYear !== undefined && r.year !== null && r.year < minReleaseYear) return false
        if (maxReleaseYear !== undefined && r.year !== null && r.year > maxReleaseYear) return false
        return true
      })

      const mapResult = (r: (typeof filteredResults)[number]) => ({
        mediaId: r.mediaId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterPath: r.posterPath,
        similarity: r.similarity,
        rank: r.rank,
        modelProvider: r.modelProvider,
        modelName: r.modelName,
      })

      // Hybrid ranking block
      let hybridResults: RecommendationCandidate[] | undefined
      let compareProfileHybridResults: RecommendationCandidate[] | undefined

      if (useHybridRanking) {
        const rankingOpts: RankingOptions = {
          limit: topK,
          explorationLevel,
          diversityEnabled,
          alreadyShownIds,
          debug: debugMode,
        }

        const [enriched, taste1, taste2] = await Promise.all([
          enrichAsHybridCandidates(filteredResults, profileId),
          profileId ? loadTasteSignals(profileId) : Promise.resolve(null),
          compareProfileId ? loadTasteSignals(compareProfileId) : Promise.resolve(null),
        ])

        hybridResults = rankHybrid(enriched, plan, taste1, rankingOpts).map(mapScoredToCandidate)

        if (compareProfileId && taste2 !== undefined) {
          compareProfileHybridResults = rankHybrid(enriched, plan, taste2, rankingOpts).map(
            mapScoredToCandidate,
          )
        }
      }

      return reply.send({
        query: rawQuery,
        topK,
        modelProvider: provider.modelProvider,
        modelName: provider.modelName,
        results: filteredResults.map(mapResult),
        compareQuery: effectiveCompareQuery,
        compareResults: rawResults.map(mapResult),
        queryPlan: plan,
        ...(hybridResults !== undefined ? { hybridResults } : {}),
        ...(compareProfileHybridResults !== undefined
          ? { compareProfileHybridResults }
          : {}),
        ...(debugMode ? { scoreModel: SCORE_MODEL_V1 } : {}),
      })
    }

    // Default path — unchanged behaviour
    const [primary, comparison] = await Promise.all([
      retrievalService.retrieve(rawQuery, topK),
      compareQuery ? retrievalService.retrieve(compareQuery, topK) : Promise.resolve(null),
    ])

    const mapResult = (r: (typeof primary)[number]) => ({
      mediaId: r.mediaId,
      mediaType: r.mediaType,
      title: r.title,
      year: r.year,
      posterPath: r.posterPath,
      similarity: r.similarity,
      rank: r.rank,
      modelProvider: r.modelProvider,
      modelName: r.modelName,
    })

    // Hybrid ranking on default (no LLM) path
    let hybridResults: RecommendationCandidate[] | undefined
    let compareProfileHybridResults: RecommendationCandidate[] | undefined

    if (useHybridRanking) {
      const fallbackPlan = rawQueryFallbackPlan(rawQuery)
      const rankingOpts: RankingOptions = {
        limit: topK,
        explorationLevel,
        diversityEnabled,
        alreadyShownIds,
        debug: debugMode,
      }

      const [enriched, taste1, taste2] = await Promise.all([
        enrichAsHybridCandidates(primary, profileId),
        profileId ? loadTasteSignals(profileId) : Promise.resolve(null),
        compareProfileId ? loadTasteSignals(compareProfileId) : Promise.resolve(null),
      ])

      hybridResults = rankHybrid(enriched, fallbackPlan, taste1, rankingOpts).map(
        mapScoredToCandidate,
      )

      if (compareProfileId && taste2 !== undefined) {
        compareProfileHybridResults = rankHybrid(enriched, fallbackPlan, taste2, rankingOpts).map(
          mapScoredToCandidate,
        )
      }
    }

    return reply.send({
      query: rawQuery,
      topK,
      modelProvider: provider.modelProvider,
      modelName: provider.modelName,
      results: primary.map(mapResult),
      ...(compareQuery && comparison
        ? {
            compareQuery,
            compareResults: comparison.map(mapResult),
          }
        : {}),
      ...(hybridResults !== undefined ? { hybridResults } : {}),
      ...(compareProfileHybridResults !== undefined ? { compareProfileHybridResults } : {}),
      ...(debugMode ? { scoreModel: SCORE_MODEL_V1 } : {}),
    })
  })

  // ── Lab: shelf history ──────────────────────────────────────────────────────

  const labInstanceSvc = new ShelfInstanceService(db)
  const labPerformanceSvc = new ShelfPerformanceService(db)
  const labFatigueSvc = new ShelfFatigueService(db)

  app.get<{
    Params: { profileId: string }
    Querystring: { limit?: string }
  }>(
    '/recommendation-lab/profiles/:profileId/shelf-history',
    async (request, reply) => {
      const { profileId } = request.params
      const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 100)

      const instances = await labInstanceSvc.listProfileShelfInstances(profileId, limit)
      if (instances.length === 0) return reply.send([])

      const conceptIds = [...new Set(instances.map((i) => i.shelfConceptId).filter(Boolean) as string[])]

      const [conceptRows, fatigueMap] = await Promise.all([
        conceptIds.length > 0
          ? db.select({ id: shelfConcepts.id, title: shelfConcepts.title })
              .from(shelfConcepts)
              .where(inArray(shelfConcepts.id, conceptIds))
          : Promise.resolve([] as { id: string; title: string }[]),
        conceptIds.length > 0
          ? labFatigueSvc.getFatigueStates(profileId, conceptIds)
          : Promise.resolve(new Map()),
      ])

      const conceptTitleById = new Map(conceptRows.map((c) => [c.id, c.title]))

      const history = await Promise.all(
        instances.map(async (inst) => {
          const perf =
            inst.shelfConceptId
              ? await labPerformanceSvc.getConceptPerformance(profileId, inst.shelfConceptId)
              : null

          return {
            instanceId: inst.id,
            conceptId: inst.shelfConceptId,
            conceptTitle: inst.shelfConceptId ? (conceptTitleById.get(inst.shelfConceptId) ?? null) : null,
            renderedTitle: inst.title,
            itemCount: inst.finalItemCount,
            firstDisplayedAt: inst.firstDisplayedAt,
            createdAt: inst.createdAt,
            impressionCount: perf?.impressionCount ?? 0,
            visibleRate: perf?.visibleRate ?? 0,
            openRate: perf?.openRate ?? 0,
            playRate: perf?.playRate ?? 0,
            fatigueState: inst.shelfConceptId
              ? (fatigueMap.get(inst.shelfConceptId) ?? null)
              : null,
          }
        }),
      )

      return reply.send(history)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/recommendation-lab/shelf-instances/:id/trace',
    async (request, reply) => {
      const { id } = request.params
      const instance = await labInstanceSvc.getShelfInstanceWithItems(id)
      if (!instance) {
        return reply.status(404).send({ error: 'ShelfInstance not found' })
      }

      const fatigueAtDisplay =
        instance.shelfConceptId
          ? (
              await labFatigueSvc.getFatigueStates(instance.profileId, [instance.shelfConceptId])
            ).get(instance.shelfConceptId) ?? null
          : null

      return reply.send({ instance, fatigueAtDisplay })
    },
  )
}
